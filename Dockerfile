# syntax=docker/dockerfile:1
# ------ Global scope variables ------

# Set of global build arguments.
# These are considered "public" and will be baked into the image.
# The convention is to prefix these with `NEXT_PUBLIC_` so that
# they can be optionally be passed as client-side environment variables
# in the webapp.
# @see: https://docs.docker.com/build/building/variables/#scoping

ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_SENTRY_WEBAPP_DSN
ARG NEXT_PUBLIC_SENTRY_BACKEND_DSN
ARG NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
ARG NEXT_PUBLIC_LANGFUSE_BASE_URL
ARG NEXT_PUBLIC_BUILD_COMMIT_SHA

# SCIP indexers to bundle for precise code navigation (comma separated).
# Supported: typescript, python, go, java. Use an empty value to bundle none.
# Approximate image size added: typescript + python ~85MB, go ~300MB (scip-go needs the
# Go toolchain at runtime to load packages), java ~425MB (JDK, Maven, sbt launcher and
# scip-java; covers Java, Kotlin and Scala projects built with Maven, Gradle or sbt).
# scip-java executes the repository's build, so it additionally requires
# PRECISE_CODE_NAV_ALLOW_BUILD_EXECUTION=true at runtime.
# @see: docs/docs/features/precise-code-navigation.mdx
ARG PRECISE_CODE_NAV_INDEXERS="typescript,python,go"
ARG SCIP_TYPESCRIPT_VERSION=0.6.2
ARG SCIP_PYTHON_VERSION=0.6.8
ARG SCIP_GO_VERSION=v0.2.10
ARG SCIP_JAVA_VERSION=0.12.3
ARG COURSIER_VERSION=v2.1.24
# Where to download the standalone coursier jar from (override when GitHub is unreachable).
ARG COURSIER_URL=https://github.com/coursier/coursier/releases/download/${COURSIER_VERSION}/coursier.jar
# sbt launcher bundled with the java indexer so that sbt (Scala) projects can be indexed.
# It boots the sbt version declared in each project's project/build.properties.
ARG SBT_LAUNCHER_VERSION=1.10.7

# Optional package mirrors for networks where the default sources are slow or
# unreachable. Leave empty to use the upstream defaults.
#   APK_MIRROR:   Alpine mirror host, e.g. mirrors.tuna.tsinghua.edu.cn
#   GOPROXY:      Go module proxy, e.g. https://goproxy.cn,direct
#   NPM_REGISTRY: npm registry, e.g. https://registry.npmmirror.com
#   MAVEN_MIRROR: Maven repository used to fetch scip-java, e.g. https://maven.aliyun.com/repository/public
ARG APK_MIRROR
ARG GOPROXY
ARG NPM_REGISTRY
ARG MAVEN_MIRROR

FROM node:24-alpine3.23 AS node-alpine
ARG APK_MIRROR
ARG NPM_REGISTRY
RUN if [ -n "$APK_MIRROR" ]; then sed -i "s#dl-cdn.alpinelinux.org#$APK_MIRROR#g" /etc/apk/repositories; fi
ENV YARN_NPM_REGISTRY_SERVER=${NPM_REGISTRY:-https://registry.npmjs.org}
ENV npm_config_registry=${NPM_REGISTRY:-https://registry.npmjs.org}

FROM golang:1.25-alpine AS go-alpine
ARG APK_MIRROR
ARG GOPROXY
RUN if [ -n "$APK_MIRROR" ]; then sed -i "s#dl-cdn.alpinelinux.org#$APK_MIRROR#g" /etc/apk/repositories; fi
ENV GOPROXY=${GOPROXY:-https://proxy.golang.org,direct}

# scip-go requires Go >= 1.26.
FROM golang:1.26-alpine AS go-scip-alpine
ARG APK_MIRROR
ARG GOPROXY
RUN if [ -n "$APK_MIRROR" ]; then sed -i "s#dl-cdn.alpinelinux.org#$APK_MIRROR#g" /etc/apk/repositories; fi
ENV GOPROXY=${GOPROXY:-https://proxy.golang.org,direct}
# ----------------------------------

# ------ SCIP indexers (precise code navigation) ------
# Each stage writes its output to /out, which stays empty when the
# corresponding language isn't selected so that it adds nothing to the image.
FROM node-alpine AS scip-node-builder
ARG PRECISE_CODE_NAV_INDEXERS
ARG SCIP_TYPESCRIPT_VERSION
ARG SCIP_PYTHON_VERSION
RUN mkdir -p /out && \
    packages=""; \
    case ",$PRECISE_CODE_NAV_INDEXERS," in *,typescript,*) packages="$packages @sourcegraph/scip-typescript@$SCIP_TYPESCRIPT_VERSION";; esac; \
    case ",$PRECISE_CODE_NAV_INDEXERS," in *,python,*) packages="$packages @sourcegraph/scip-python@$SCIP_PYTHON_VERSION";; esac; \
    if [ -n "$packages" ]; then \
        mkdir -p /out/scip-node && cd /out/scip-node && \
        npm init -y > /dev/null && \
        npm install --omit=dev --no-audit --no-fund $packages && \
        rm -rf /root/.npm; \
    fi

FROM go-scip-alpine AS scip-go-builder
ARG PRECISE_CODE_NAV_INDEXERS
ARG SCIP_GO_VERSION
# scip-go shells out to `go` to load packages, so the toolchain is bundled as well.
RUN mkdir -p /out && \
    case ",$PRECISE_CODE_NAV_INDEXERS," in *,go,*) \
        CGO_ENABLED=0 GOBIN=/out/scip-bin go install github.com/scip-code/scip-go/cmd/scip-go@$SCIP_GO_VERSION && \
        cp -a /usr/local/go /out/go && \
        rm -rf /root/go /root/.cache;; \
    esac

FROM node-alpine AS scip-java-builder
ARG PRECISE_CODE_NAV_INDEXERS
ARG SCIP_JAVA_VERSION
ARG COURSIER_VERSION
ARG COURSIER_URL
ARG MAVEN_MIRROR
ARG SBT_LAUNCHER_VERSION
RUN mkdir -p /out && \
    case ",$PRECISE_CODE_NAV_INDEXERS," in *,java,*) \
        if [ -n "$MAVEN_MIRROR" ]; then export COURSIER_REPOSITORIES="ivy2Local|$MAVEN_MIRROR"; fi && \
        apk add --no-cache openjdk17-jre-headless curl && \
        curl -fsSL --http1.1 --retry 5 --retry-all-errors -o /tmp/coursier.jar "$COURSIER_URL" && \
        mkdir -p /out/scip-bin && \
        java -jar /tmp/coursier.jar bootstrap --standalone -o /out/scip-bin/scip-java \
            "com.sourcegraph:scip-java_2.13:$SCIP_JAVA_VERSION" \
            --main com.sourcegraph.scip_java.ScipJava && \
        mkdir -p /out/sbt && \
        cp "$(java -jar /tmp/coursier.jar fetch --intransitive "org.scala-sbt:sbt-launch:$SBT_LAUNCHER_VERSION")" /out/sbt/sbt-launch.jar && \
        printf '%s\n' \
            '#!/bin/sh' \
            '# Minimal sbt runner used by scip-java to index sbt (Scala) projects.' \
            'exec java -Xms512m -Xmx2g -Dsbt.log.noformat=true $SBT_OPTS -jar /opt/sbt/sbt-launch.jar "$@"' \
            > /out/scip-bin/sbt && \
        chmod +x /out/scip-bin/sbt;; \
    esac
# ----------------------------------------------------

# ------ Build Zoekt ------
FROM go-alpine AS zoekt-builder
RUN apk add --no-cache ca-certificates
WORKDIR /zoekt
COPY vendor/zoekt/go.mod vendor/zoekt/go.sum ./
RUN go mod download
COPY vendor/zoekt ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /cmd/ ./cmd/...
# -------------------------

# ------ Build shared libraries ------
FROM node-alpine AS shared-libs-builder
WORKDIR /app

COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn ./.yarn
COPY ./packages/db ./packages/db
COPY ./packages/schemas ./packages/schemas
COPY ./packages/shared ./packages/shared
COPY ./packages/queryLanguage ./packages/queryLanguage

RUN yarn workspace @sourcebot/db install
RUN yarn workspace @sourcebot/schemas install
RUN yarn workspace @sourcebot/shared install
RUN yarn workspace @sourcebot/query-language install
# ------------------------------------

# ------ Build Web ------
FROM node-alpine AS web-builder
ENV SKIP_ENV_VALIDATION=1
# -----------
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_SENTRY_WEBAPP_DSN
ENV NEXT_PUBLIC_SENTRY_WEBAPP_DSN=$NEXT_PUBLIC_SENTRY_WEBAPP_DSN
ARG NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
ENV NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY=$NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
ARG NEXT_PUBLIC_LANGFUSE_BASE_URL
ENV NEXT_PUBLIC_LANGFUSE_BASE_URL=$NEXT_PUBLIC_LANGFUSE_BASE_URL
ARG NEXT_PUBLIC_BUILD_COMMIT_SHA
ENV NEXT_PUBLIC_BUILD_COMMIT_SHA=$NEXT_PUBLIC_BUILD_COMMIT_SHA

# To upload source maps to Sentry, we need to set the following build-time args.
# It's important that we don't set these for oss builds, otherwise the Sentry
# auth token will be exposed.
# @see : next.config.mjs
ARG SENTRY_ORG
ENV SENTRY_ORG=$SENTRY_ORG
ARG SENTRY_WEBAPP_PROJECT
ENV SENTRY_WEBAPP_PROJECT=$SENTRY_WEBAPP_PROJECT
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
# SMUAT = Source Map Upload Auth Token
ARG SENTRY_SMUAT
ENV SENTRY_SMUAT=$SENTRY_SMUAT
# -----------

RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn ./.yarn
COPY ./packages/web ./packages/web
COPY --from=shared-libs-builder /app/node_modules ./node_modules
COPY --from=shared-libs-builder /app/packages/db ./packages/db
COPY --from=shared-libs-builder /app/packages/schemas ./packages/schemas
COPY --from=shared-libs-builder /app/packages/shared ./packages/shared
COPY --from=shared-libs-builder /app/packages/queryLanguage ./packages/queryLanguage

# Fixes arm64 timeouts
RUN yarn workspace @sourcebot/web install

ENV NEXT_TELEMETRY_DISABLED=1
RUN yarn workspace @sourcebot/web build
ENV SKIP_ENV_VALIDATION=0
# ------------------------------

# ------ Build Backend ------
FROM node-alpine AS backend-builder
ENV SKIP_ENV_VALIDATION=1
# -----------

# To upload source maps to Sentry, we need to set the following build-time args.
# It's important that we don't set these for oss builds, otherwise the Sentry
# auth token will be exposed.
ARG SENTRY_ORG
ENV SENTRY_ORG=$SENTRY_ORG
ARG SENTRY_BACKEND_PROJECT
ENV SENTRY_BACKEND_PROJECT=$SENTRY_BACKEND_PROJECT
# SMUAT = Source Map Upload Auth Token
ARG SENTRY_SMUAT
ENV SENTRY_SMUAT=$SENTRY_SMUAT
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
# -----------

WORKDIR /app

COPY package.json yarn.lock* .yarnrc.yml ./
COPY .yarn ./.yarn
COPY ./schemas ./schemas
COPY ./packages/backend ./packages/backend
COPY --from=shared-libs-builder /app/node_modules ./node_modules
COPY --from=shared-libs-builder /app/packages/db ./packages/db
COPY --from=shared-libs-builder /app/packages/schemas ./packages/schemas
COPY --from=shared-libs-builder /app/packages/shared ./packages/shared
COPY --from=shared-libs-builder /app/packages/queryLanguage ./packages/queryLanguage
RUN yarn workspace @sourcebot/backend install
RUN yarn workspace @sourcebot/backend build

# Upload source maps to Sentry if we have the necessary build-time args.
RUN if [ -n "$SENTRY_SMUAT" ] && [ -n "$SENTRY_ORG" ] && [ -n "$SENTRY_BACKEND_PROJECT" ] && [ -n "$SENTRY_RELEASE" ]; then \
    apk add --no-cache curl; \
    curl -sL https://sentry.io/get-cli/ | sh; \
    sentry-cli login --auth-token $SENTRY_SMUAT; \
    sentry-cli sourcemaps inject --org $SENTRY_ORG --project $SENTRY_BACKEND_PROJECT --release $SENTRY_RELEASE ./packages/backend/dist; \
    sentry-cli sourcemaps upload --org $SENTRY_ORG --project $SENTRY_BACKEND_PROJECT --release $SENTRY_RELEASE ./packages/backend/dist; \
fi

ENV SKIP_ENV_VALIDATION=0
# ------------------------------

# ------ Runner ------
FROM node-alpine AS runner
# -----------
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG NEXT_PUBLIC_SENTRY_WEBAPP_DSN
ENV NEXT_PUBLIC_SENTRY_WEBAPP_DSN=$NEXT_PUBLIC_SENTRY_WEBAPP_DSN
ARG NEXT_PUBLIC_SENTRY_BACKEND_DSN
ENV NEXT_PUBLIC_SENTRY_BACKEND_DSN=$NEXT_PUBLIC_SENTRY_BACKEND_DSN
ARG NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
ENV NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY=$NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY
ARG NEXT_PUBLIC_LANGFUSE_BASE_URL
ENV NEXT_PUBLIC_LANGFUSE_BASE_URL=$NEXT_PUBLIC_LANGFUSE_BASE_URL
ARG NEXT_PUBLIC_BUILD_COMMIT_SHA
ENV NEXT_PUBLIC_BUILD_COMMIT_SHA=$NEXT_PUBLIC_BUILD_COMMIT_SHA
# -----------

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/data
ENV DATA_CACHE_DIR=$DATA_DIR/.sourcebot
ENV DATABASE_DATA_DIR=$DATA_CACHE_DIR/db
ENV REDIS_DATA_DIR=$DATA_CACHE_DIR/redis
ENV SOURCEBOT_PUBLIC_KEY_PATH=/app/public.pem
# Valid values are: debug, info, warn, error
ENV SOURCEBOT_LOG_LEVEL=info

# Configure dependencies
RUN apk add --no-cache git ca-certificates bind-tools tini jansson wget supervisor curl perl jq redis postgresql16 postgresql16-contrib openssl util-linux unzip && \
    apk upgrade --no-cache

# Configure SCIP indexers (precise code navigation)
ARG PRECISE_CODE_NAV_INDEXERS
ENV PRECISE_CODE_NAV_LANGUAGES=$PRECISE_CODE_NAV_INDEXERS
# scip-java needs a JDK and the build tool to compile the project, and bash for
# the javac wrapper it injects into the build.
RUN case ",$PRECISE_CODE_NAV_INDEXERS," in *,java,*) apk add --no-cache openjdk17-jdk maven bash;; esac
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk
COPY --from=scip-node-builder /out/ /opt/
COPY --from=scip-go-builder /out/ /opt/
COPY --from=scip-java-builder /out/ /opt/
RUN mkdir -p /opt/scip-bin && \
    for bin in scip-typescript scip-python; do \
        if [ -e "/opt/scip-node/node_modules/.bin/$bin" ]; then ln -s "/opt/scip-node/node_modules/.bin/$bin" "/opt/scip-bin/$bin"; fi; \
    done
ENV PATH=/opt/scip-bin:/opt/go/bin:$PATH
# Keep downloaded dependencies (Go modules, Maven artifacts) on the data volume
# so they survive restarts and aren't re-downloaded for every index.
ENV GOPATH=$DATA_CACHE_DIR/scip-cache/go
ENV GOCACHE=$DATA_CACHE_DIR/scip-cache/go-build
ENV MAVEN_OPTS="-Dmaven.repo.local=$DATA_CACHE_DIR/scip-cache/m2"
ENV COURSIER_CACHE=$DATA_CACHE_DIR/scip-cache/coursier
ENV SBT_OPTS="-Dsbt.global.base=$DATA_CACHE_DIR/scip-cache/sbt -Dsbt.boot.directory=$DATA_CACHE_DIR/scip-cache/sbt/boot -Dsbt.ivy.home=$DATA_CACHE_DIR/scip-cache/ivy2"

# Remove npm (unused — we use Yarn). The Node.js base image bundles npm
# with its own transitive dependencies (minimatch, tar, picomatch, etc.)
# that Trivy flags as vulnerable. Since npm is never invoked at runtime,
# removing it eliminates these false positives and reduces image size.
RUN rm -rf /usr/local/lib/node_modules/npm && \
    rm -rf /usr/local/bin/npm && \
    rm -rf /usr/local/bin/npx && \
    rm -rf /root/.npm && \
    rm -rf /root/.node-gyp

ARG UID=1500
ARG GID=1500

# Always create the non-root user to support runtime user switching
# The container can be run as root (default) or as sourcebot user using docker run --user
RUN addgroup -g $GID sourcebot && \
    adduser -D -u $UID -h /app -S sourcebot && \
    adduser sourcebot postgres && \
    adduser sourcebot redis && \
    chown -R sourcebot /app && \
    adduser sourcebot node && \
    mkdir /var/log/sourcebot && \
    chown sourcebot /var/log/sourcebot

COPY package.json yarn.lock* .yarnrc.yml public.pem ./
COPY .yarn ./.yarn

# Configure zoekt
COPY vendor/zoekt/install-ctags-alpine.sh .
# The script downloads ctags from GitHub with curl; force HTTP/1.1 and retry on any
# error, which is more reliable on flaky networks / proxies.
RUN printf '%s\n' '--http1.1' '--retry-all-errors' > /root/.curlrc && \
    ./install-ctags-alpine.sh && rm install-ctags-alpine.sh && rm /root/.curlrc && \
    # Clean up ctags build artifacts
    rm -rf /tmp/*
RUN mkdir -p ${DATA_CACHE_DIR}
COPY --from=zoekt-builder \
/cmd/zoekt-git-index \
/cmd/zoekt-indexserver \
/cmd/zoekt-mirror-github \
/cmd/zoekt-mirror-gitiles \
/cmd/zoekt-mirror-bitbucket-server \
/cmd/zoekt-mirror-gitlab \
/cmd/zoekt-mirror-gerrit \
/cmd/zoekt-webserver \
/cmd/zoekt-index \
/usr/local/bin/

RUN chown -R sourcebot:sourcebot /app

# Copy zoekt proto files (needed for gRPC client at runtime)
COPY --chown=sourcebot:sourcebot vendor/zoekt/grpc/protos /app/vendor/zoekt/grpc/protos

# Copy OpenAPI docs
COPY --chown=sourcebot:sourcebot docs/api-reference/sourcebot-public.openapi.json /app/docs/api-reference/sourcebot-public.openapi.json

# Copy all of the things
COPY --chown=sourcebot:sourcebot --from=web-builder /app/packages/web/public ./packages/web/public
COPY --chown=sourcebot:sourcebot --from=web-builder /app/packages/web/.next/standalone ./
COPY --chown=sourcebot:sourcebot --from=web-builder /app/packages/web/.next/static ./packages/web/.next/static

COPY --chown=sourcebot:sourcebot --from=backend-builder /app/node_modules ./node_modules
COPY --chown=sourcebot:sourcebot --from=backend-builder /app/packages/backend ./packages/backend

COPY --chown=sourcebot:sourcebot --from=shared-libs-builder /app/packages/db ./packages/db
COPY --chown=sourcebot:sourcebot --from=shared-libs-builder /app/packages/schemas ./packages/schemas
COPY --chown=sourcebot:sourcebot --from=shared-libs-builder /app/packages/shared ./packages/shared
COPY --chown=sourcebot:sourcebot --from=shared-libs-builder /app/packages/queryLanguage ./packages/queryLanguage

# Fixes git "dubious ownership" issues when the volume is mounted with different permissions to the container.
RUN git config --global safe.directory "*"

# Configure the database
RUN mkdir -p /run/postgresql && \
    chown -R postgres:postgres /run/postgresql && \
    chmod 775 /run/postgresql

# Make app directory accessible to both root and sourcebot user
RUN chown -R sourcebot /app \
	&& chgrp -R 0  /app \
	&& chmod -R g=u /app
# Make data directory accessible to both root and sourcebot user
RUN chown -R sourcebot /data

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY prefix-output.sh ./prefix-output.sh
RUN chmod +x ./prefix-output.sh
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Note: for back-compat cases, we do _not_ set the USER directive here.
# Instead, the user can be overridden at runtime with --user flag.
# USER sourcebot

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["/sbin/tini", "--", "./entrypoint.sh"]
# ------------------------------