#!/usr/bin/env bash

cd "${0%/*}" || exit

(cd ./src && \
    deno run \
        --unstable \
        --watch \
        --allow-net \
        --allow-env \
    main.ts)