.PHONY: setup dev test build deploy-backend deploy-frontend deploy-all lint clean

PROJECT_ID ?= trust-trailblazers
REGION ?= us-central1
REPOSITORY ?= land-guard

setup:
	@echo "Setting up local development environment..."
	cd backend && python -m venv venv && ./venv/bin/pip install -r requirements.txt
	cd frontend && npm install

dev:
	docker-compose up --build

test:
	cd backend && pytest
	cd frontend && npm test

build:
	docker build -t $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(REPOSITORY)/backend ./backend
	docker build -t $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(REPOSITORY)/frontend ./frontend

deploy-backend:
	gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=$(REGION),_REPOSITORY=$(REPOSITORY) --project $(PROJECT_ID)

deploy-frontend:
	# Note: cloudbuild.yaml currently handles both. This is a specific trigger.
	gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=$(REGION),_REPOSITORY=$(REPOSITORY) --project $(PROJECT_ID)

deploy-all:
	gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=$(REGION),_REPOSITORY=$(REPOSITORY) --project $(PROJECT_ID)

lint:
	cd backend && flake8 .
	cd frontend && npm run lint

clean:
	docker-compose down -v
	find . -type d -name "__pycache__" -exec rm -rf {} +
	rm -rf frontend/.next
	rm -rf backend/venv
