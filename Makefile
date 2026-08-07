.PHONY: help backend-install backend-test backend-lint infra-install infra-synth infra-test infra-lint frontend-install frontend-dev frontend-build frontend-lint deploy bootstrap-admin

help:
	@echo "Common targets:"
	@echo "  backend-install    Create backend/.venv and install dependencies"
	@echo "  backend-test       Run backend unit tests (pytest + moto)"
	@echo "  backend-lint       Lint backend Lambda code (ruff)"
	@echo "  infra-install      Create infrastructure/.venv and install CDK dependencies"
	@echo "  infra-synth        cdk synth (requires Docker running + -c context values)"
	@echo "  infra-test         Run CDK assertion tests"
	@echo "  infra-lint         Lint CDK app code (ruff)"
	@echo "  frontend-install   npm install frontend dependencies"
	@echo "  frontend-dev       Run the frontend dev server"
	@echo "  frontend-build     Type-check + build the frontend"
	@echo "  frontend-lint      Lint frontend code (eslint)"
	@echo "  deploy             Full manual deploy (see scripts/deploy.sh)"
	@echo "  bootstrap-admin    Create the first Cognito admin user"

backend-install:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt

backend-test:
	cd backend && . .venv/bin/activate && pytest -q

backend-lint:
	cd backend && . .venv/bin/activate && ruff check .

infra-install:
	cd infrastructure && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && pip install pytest ruff

infra-synth:
	cd infrastructure && . .venv/bin/activate && cdk synth --all

infra-test:
	cd infrastructure && . .venv/bin/activate && pytest -q

infra-lint:
	cd infrastructure && . .venv/bin/activate && ruff check .

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

frontend-lint:
	cd frontend && npm run lint

deploy:
	./scripts/deploy.sh

bootstrap-admin:
	./scripts/bootstrap-admin.sh $(USER_POOL_ID) $(ADMIN_EMAIL)
