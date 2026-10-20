from fastapi.testclient import TestClient
from app.main import app

def test_read_root():
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "SignVision API"
        assert data["version"] == "1.0.0"

def test_health_check():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ("healthy", "degraded")
        assert "word_count" in data

def test_lookup_word():
    with TestClient(app) as client:
        response = client.get("/lookup/hello")
        assert response.status_code == 200
        data = response.json()
        assert "word" in data
        assert data["word"].lower() == "hello"

def test_semantic_search():
    with TestClient(app) as client:
        response = client.get("/search?query=hello&top_k=2")
        assert response.status_code == 200
        data = response.json()
        assert data["query"] == "hello"
        assert "results" in data
        assert isinstance(data["results"], list)
