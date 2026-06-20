ifeq (,$(wildcard .env))
$(shell cp .env.example .env)
endif
-include .env
export

.PHONY: up down restart clean build-shared migrate migration-run fixtures \
        shell-db lint test-backend-unit test-backend-unit-cov teste2e \
        test-frontend-unit test-frontend-unit-cov test-frontend-e2e \
        test-shared-unit-cov test-all test-coverage-check pr-check

up:            ## start infra (db, redis, mailpit)
	docker compose up -d

down:
	docker compose down

restart:
	$(MAKE) down
	$(MAKE) up

clean:
	docker compose down -v

build-shared:  ## compile @sobrebox/shared so consumers can import it
	pnpm --filter @sobrebox/shared run build

shell-db:
	docker compose exec sobrebox-db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

migrate:       ## create a new prisma migration (name=...)
	pnpm --filter @sobrebox/api exec prisma migrate dev --name $(name)

migration-run: ## apply migrations
	pnpm --filter @sobrebox/api exec prisma migrate deploy

fixtures: build-shared  ## seed db
	pnpm --filter @sobrebox/api run seed

lint:
	pnpm run lint

test-shared-unit-cov:
	pnpm --filter @sobrebox/shared run test:cov

test-backend-unit: build-shared
	pnpm --filter @sobrebox/api run test
test-backend-unit-cov: build-shared
	pnpm --filter @sobrebox/api run test:cov
teste2e: build-shared
	pnpm --filter @sobrebox/api run test:e2e

test-frontend-unit: build-shared
	pnpm --filter @sobrebox/web run test
test-frontend-unit-cov: build-shared
	pnpm --filter @sobrebox/web run test:cov
test-frontend-e2e:  ## Playwright deferred to epic 3
	@echo "frontend e2e deferred to epic 3 (opening-animation flow)"

test-all: test-backend-unit teste2e test-frontend-unit

test-coverage-check: test-shared-unit-cov test-backend-unit-cov test-frontend-unit-cov

pr-check: lint test-coverage-check
