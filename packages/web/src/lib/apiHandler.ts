import { NextRequest } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => Promise<Response> | Response;

/**
 * Wraps an API route handler.
 *
 * @example
 * // Simple handler
 * export const GET = apiHandler(async (request) => {
 *     return Response.json({ data: 'hello' });
 * });
 *
 * @example
 * // Handler with route params
 * export const GET = apiHandler(async (request, { params }) => {
 *     const { id } = await params;
 *     return Response.json({ id });
 * });
 */
export function apiHandler<H extends AnyHandler>(handler: H): H {
    const wrappedHandler = async (request: NextRequest, ...rest: unknown[]) => {
        return handler(request, ...rest);
    };

    return wrappedHandler as H;
}
