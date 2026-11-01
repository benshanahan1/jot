.PHONY: dev build test lint install-cli uninstall-cli

dev:
	npm run tauri dev

build:
	npm run tauri build

test:
	npm test

lint:
	npm run lint

install-cli:
	./scripts/install-cli.sh

uninstall-cli:
	./scripts/install-cli.sh --uninstall
