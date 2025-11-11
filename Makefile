PYTHON=python

.PHONY: frontend backend dev

deploy:
	@echo "Use dedicated deployment scripts"

frontend:
	cd frontend && npm install && npm run dev

backend:
	cd backend && poetry install && poetry run uvicorn app.main:app --reload
