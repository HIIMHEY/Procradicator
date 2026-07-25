from fastapi.testclient import TestClient
from src.main import app


def test_friend_search_requires_login() -> None:
    response = TestClient(app).get("/friends/search", params={"username": "marcus"})

    assert response.status_code == 401
