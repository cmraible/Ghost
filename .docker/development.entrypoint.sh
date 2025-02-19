#!/bin/bash

if ! git submodule update --init --recursive; then
    echo "Error: Failed to update git submodules"
    echo "Please run the following command locally to update the submodules:"
    echo "git submodule update --init --recursive"
    exit 1
fi

# Execute the CMD
exec "$@"