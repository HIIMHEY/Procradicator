.PHONY: test-all format-all lint-all

test-all:
	cd apps/mobile && pnpm run test
	cd apps/server && $(MAKE) test

format-all:
	cd apps/mobile && pnpm run format
	cd apps/server && $(MAKE) format

lint-all:
	cd apps/mobile && pnpm run lint
	cd apps/server && $(MAKE) lint

