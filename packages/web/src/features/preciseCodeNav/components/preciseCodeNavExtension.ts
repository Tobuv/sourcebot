'use client';

import { isServiceError } from "@/lib/utils";
import { Extension, StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, hoverTooltip, Tooltip, ViewPlugin } from "@codemirror/view";
import { getPreciseHover } from "../client";
import { PreciseHoverResponse, SymbolPosition } from "../types";

export type PreciseCodeNavHandlers = {
    onGoToDefinition: (position: SymbolPosition, displayName: string) => void;
    onFindReferences: (position: SymbolPosition, displayName: string) => void;
};

type Location = Omit<SymbolPosition, 'line' | 'character'>;

const MAX_CACHE_SIZE = 200;
const LINK_LOOKUP_DELAY_MS = 60;

/** Range of the symbol shown as a link while Ctrl / Cmd is held (null to clear). */
const setLinkRange = StateEffect.define<{ from: number, to: number } | null>();

const linkMark = Decoration.mark({ class: "cm-precise-link" });

const linkRangeField = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(decorations, transaction) {
        decorations = decorations.map(transaction.changes);
        for (const effect of transaction.effects) {
            if (effect.is(setLinkRange)) {
                decorations = effect.value && effect.value.from < effect.value.to
                    ? Decoration.set([linkMark.range(effect.value.from, effect.value.to)])
                    : Decoration.none;
            }
        }
        return decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
});

const linkTheme = EditorView.baseTheme({
    ".cm-precise-link": {
        cursor: "pointer",
        textDecoration: "underline",
    },
    // Hide the native text cursor while Ctrl / Cmd is held over the editor.
    "&.cm-precise-link-mode .cm-content": {
        cursor: "default",
    },
});

const isModifierPressed = (event: MouseEvent | KeyboardEvent) => event.metaKey || event.ctrlKey;

const toPosition = (view: EditorView, offset: number, location: Location): SymbolPosition => {
    const line = view.state.doc.lineAt(offset);
    return {
        ...location,
        line: line.number - 1,
        character: offset - line.from,
    };
}

const getDisplayName = (view: EditorView, hover: NonNullable<PreciseHoverResponse>) => {
    if (hover.displayName) {
        return hover.displayName;
    }
    const doc = view.state.doc;
    if (hover.range.startLine >= doc.lines) {
        return hover.symbol;
    }
    const line = doc.line(hover.range.startLine + 1);
    return line.text.slice(hover.range.startChar, hover.range.endLine === hover.range.startLine ? hover.range.endChar : undefined) || hover.symbol;
}

const createTooltipDom = (
    view: EditorView,
    hover: NonNullable<PreciseHoverResponse>,
    position: SymbolPosition,
    handlers: { current: PreciseCodeNavHandlers },
) => {
    const displayName = getDisplayName(view, hover);

    const dom = document.createElement('div');
    dom.className = 'flex flex-col gap-2 p-2 text-sm max-w-[640px] max-h-[360px] overflow-auto';

    const header = document.createElement('div');
    header.className = 'flex flex-row items-center gap-2';
    if (hover.kind || hover.isLocal) {
        const kind = document.createElement('span');
        kind.className = 'text-xs px-1.5 py-0.5 rounded border border-border text-muted-foreground';
        kind.textContent = hover.isLocal ? 'Local' : hover.kind!;
        header.appendChild(kind);
    }
    const name = document.createElement('span');
    name.className = 'font-mono font-semibold';
    name.textContent = displayName;
    header.appendChild(name);
    const precise = document.createElement('span');
    precise.className = 'ml-auto text-xs text-muted-foreground';
    precise.textContent = 'Precise';
    precise.title = 'Resolved using a precise code intelligence (SCIP) index';
    header.appendChild(precise);
    dom.appendChild(header);

    if (hover.signature) {
        const signature = document.createElement('pre');
        signature.className = 'font-mono text-xs whitespace-pre-wrap break-words bg-muted rounded px-2 py-1';
        signature.textContent = hover.signature;
        dom.appendChild(signature);
    }

    const actions = document.createElement('div');
    actions.className = 'flex flex-row gap-2';
    const makeButton = (label: string, onClick: () => void) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'text-xs px-2 py-1 rounded border border-border hover:bg-accent';
        button.textContent = label;
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', (event) => {
            event.preventDefault();
            onClick();
        });
        return button;
    }
    actions.appendChild(makeButton('Go to definition', () => handlers.current.onGoToDefinition(position, displayName)));
    actions.appendChild(makeButton('Find references', () => handlers.current.onFindReferences(position, displayName)));
    dom.appendChild(actions);

    if (hover.documentation) {
        const documentation = document.createElement('div');
        documentation.className = 'whitespace-pre-wrap break-words text-xs text-muted-foreground border-t border-border pt-2';
        documentation.textContent = hover.documentation;
        dom.appendChild(documentation);
    }


    return dom;
}

/**
 * CodeMirror extension providing precise code navigation:
 * - hovering a symbol shows its signature and documentation;
 * - Ctrl / Cmd + click jumps to the definition.
 */
export const preciseCodeNavExtension = (
    location: Location,
    handlers: { current: PreciseCodeNavHandlers },
): Extension => {
    // Cache of resolved hovers, keyed by occurrence range, so moving the mouse
    // within the same symbol doesn't refetch.
    const cache: { line: number, from: number, to: number, hover: NonNullable<PreciseHoverResponse> }[] = [];
    const misses = new Set<string>();

    const lookup = async (view: EditorView, offset: number) => {
        const position = toPosition(view, offset, location);
        const cached = cache.find((entry) => entry.line === position.line && position.character >= entry.from && position.character <= entry.to);
        if (cached) {
            return { position, hover: cached.hover };
        }
        const key = `${position.line}:${position.character}`;
        if (misses.has(key)) {
            return { position, hover: null };
        }

        const response = await getPreciseHover(position);
        if (isServiceError(response) || !response) {
            misses.add(key);
            return { position, hover: null };
        }

        if (response.range.startLine === response.range.endLine) {
            cache.push({ line: response.range.startLine, from: response.range.startChar, to: response.range.endChar, hover: response });
            if (cache.length > MAX_CACHE_SIZE) {
                cache.shift();
            }
        }
        return { position, hover: response };
    }

    // Maps an occurrence range to document offsets on the hovered line.
    const getRangeOffsets = (view: EditorView, position: SymbolPosition, hover: NonNullable<PreciseHoverResponse>, offset: number) => {
        const lineFrom = view.state.doc.line(position.line + 1).from;
        return {
            from: hover.range.startLine === position.line ? lineFrom + hover.range.startChar : offset,
            to: hover.range.endLine === position.line ? lineFrom + hover.range.endChar : offset,
        };
    }

    const tooltip = hoverTooltip(async (view, offset): Promise<Tooltip | null> => {
        const { position, hover } = await lookup(view, offset);
        if (!hover) {
            return null;
        }

        const { from, to } = getRangeOffsets(view, position, hover, offset);

        return {
            pos: from,
            end: to,
            above: true,
            create: () => ({ dom: createTooltipDom(view, hover, position, handlers) }),
        };
    }, { hoverTime: 300 });

    const clickHandler = EditorView.domEventHandlers({
        click: (event, view) => {
            if (!(event.metaKey || event.ctrlKey) || event.button !== 0) {
                return false;
            }
            const offset = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (offset === null) {
                return false;
            }
            event.preventDefault();
            lookup(view, offset).then(({ position, hover }) => {
                if (hover) {
                    handlers.current.onGoToDefinition(position, getDisplayName(view, hover));
                }
            });
            return true;
        },
    });

    // While Ctrl / Cmd is held, underline the symbol under the mouse and show a
    // pointer cursor, so it's clear that clicking navigates to its definition.
    const linkPlugin = ViewPlugin.fromClass(class {
        private mouse: { x: number, y: number } | null = null;
        private modifierPressed = false;
        private timer: ReturnType<typeof setTimeout> | undefined;
        private requestId = 0;
        private current: { from: number, to: number } | null = null;

        constructor(private view: EditorView) {
            view.dom.addEventListener('mousemove', this.onMouseMove);
            view.dom.addEventListener('mouseleave', this.onMouseLeave);
            window.addEventListener('keydown', this.onKey);
            window.addEventListener('keyup', this.onKey);
            window.addEventListener('blur', this.onBlur);
        }

        private onMouseMove = (event: MouseEvent) => {
            this.mouse = { x: event.clientX, y: event.clientY };
            this.setModifier(isModifierPressed(event));
            this.schedule();
        }

        private onMouseLeave = () => {
            this.mouse = null;
            this.clear();
        }

        private onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Control' && event.key !== 'Meta') {
                return;
            }
            this.setModifier(isModifierPressed(event));
            this.schedule();
        }

        private onBlur = () => {
            this.setModifier(false);
            this.clear();
        }

        private setModifier(pressed: boolean) {
            if (this.modifierPressed === pressed) {
                return;
            }
            this.modifierPressed = pressed;
            this.view.dom.classList.toggle('cm-precise-link-mode', pressed);
        }

        private schedule() {
            clearTimeout(this.timer);
            if (!this.modifierPressed || !this.mouse) {
                this.clear();
                return;
            }
            this.timer = setTimeout(() => this.refresh(), LINK_LOOKUP_DELAY_MS);
        }

        private async refresh() {
            const mouse = this.mouse;
            if (!this.modifierPressed || !mouse) {
                return;
            }
            const offset = this.view.posAtCoords(mouse);
            if (offset === null) {
                this.clear();
                return;
            }
            // Already showing the link for this position.
            if (this.current && offset >= this.current.from && offset < this.current.to) {
                return;
            }

            const requestId = ++this.requestId;
            const { position, hover } = await lookup(this.view, offset);
            // Ignore stale results (mouse moved, key released, ...).
            if (requestId !== this.requestId || !this.modifierPressed || !this.mouse) {
                return;
            }
            if (!hover) {
                this.clear();
                return;
            }
            const range = getRangeOffsets(this.view, position, hover, offset);
            this.current = range;
            this.view.dispatch({ effects: setLinkRange.of(range) });
        }

        private clear() {
            clearTimeout(this.timer);
            this.requestId++;
            if (this.current) {
                this.current = null;
                this.view.dispatch({ effects: setLinkRange.of(null) });
            }
        }

        destroy() {
            clearTimeout(this.timer);
            this.view.dom.removeEventListener('mousemove', this.onMouseMove);
            this.view.dom.removeEventListener('mouseleave', this.onMouseLeave);
            window.removeEventListener('keydown', this.onKey);
            window.removeEventListener('keyup', this.onKey);
            window.removeEventListener('blur', this.onBlur);
        }
    });

    return [tooltip, clickHandler, linkRangeField, linkTheme, linkPlugin];
}
