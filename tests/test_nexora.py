import pytest
from app import app
from integration import PRODUCTS


@pytest.fixture
def client():
    app.config["TESTING"] = True

    with app.test_client() as client:
        yield client


def test_validar_produto_no_carrinho(client):
    produto = PRODUCTS[0]

    resposta = client.post(
        "/api/shop/cart/validate",
        json={
            "items": [
                {
                    "id": produto["id"],
                    "quantity": 1
                }
            ]
        }
    )

    assert resposta.status_code == 200

    dados = resposta.get_json()

    assert dados["status"] == "validated"
    assert len(dados["items"]) == 1
    assert dados["items"][0]["id"] == produto["id"]
    assert dados["items"][0]["quantity"] == 1