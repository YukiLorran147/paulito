# INTEGRAÇÃO — chamado por app.py via register_ecommerce_routes(app)
from flask import render_template, jsonify, request

PRODUCTS = [
    {"id": 101, "name": "Teclado mecânico Orion", "category": "Periféricos", "price": 249.90, "stock": 12,
     "image": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85",
     "description": "Teclado mecânico com conexão USB-C e construção sólida.", "featured": 1},
    {"id": 102, "name": "Mouse sem fio Vector", "category": "Periféricos", "price": 159.90, "stock": 18,
     "image": "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=85",
     "description": "Mouse sem fio ergonômico com sensor preciso.", "featured": 2},
    {"id": 103, "name": "Headset Studio Pro", "category": "Áudio", "price": 389.00, "stock": 7,
     "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85",
     "description": "Headset confortável para reuniões e criação de conteúdo.", "featured": 3},
    {"id": 104, "name": "Monitor UltraView 27", "category": "Monitores", "price": 1499.00, "stock": 5,
     "image": "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=85",
     "description": "Monitor de 27 polegadas para uma área de trabalho ampla.", "featured": 4},
    {"id": 105, "name": "Webcam Focus 4K", "category": "Acessórios", "price": 459.90, "stock": 9,
     "image": "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?auto=format&fit=crop&w=900&q=85",
     "description": "Webcam para videoconferências e gravações.", "featured": 5},
    {"id": 106, "name": "SSD portátil Atlas 1 TB", "category": "Armazenamento", "price": 629.90, "stock": 10,
     "image": "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=85",
     "description": "Armazenamento portátil compacto para arquivos e projetos.", "featured": 6},
    {"id": 107, "name": "Microfone Pulse USB", "category": "Áudio", "price": 319.90, "stock": 0,
     "image": "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=900&q=85",
     "description": "Microfone USB para aulas, chamadas e produção de áudio.", "featured": 7},
    {"id": 108, "name": "Hub USB-C Dock 7", "category": "Acessórios", "price": 279.90, "stock": 15,
     "image": "https://images.unsplash.com/photo-1625842268584-8f3296236761?auto=format&fit=crop&w=900&q=85",
     "description": "Hub compacto com múltiplas portas para notebooks.", "featured": 8},
]


def _find_product(pid: int):
    return next((p for p in PRODUCTS if p["id"] == pid), None)


def register_ecommerce_routes(app):
    """Chame uma vez com o app Flask existente: register_ecommerce_routes(app)."""

    @app.get("/ecommerce")
    def ecommerce_page():
        return render_template("ecommerce.html")

    @app.get("/api/shop/health")
    def ecommerce_health():
        return jsonify(status="ok", service="nexora-commerce")

    @app.get("/api/shop/categories")
    def ecommerce_categories():
        return jsonify(items=sorted({p["category"] for p in PRODUCTS}, key=str.casefold))

    @app.get("/api/shop/products")
    def ecommerce_products():
        q = request.args.get("q", "").strip().casefold()
        category = request.args.get("category", "").strip()
        sort = request.args.get("sort", "featured")
        if sort not in {"featured", "price-asc", "price-desc", "name-asc"}:
            return jsonify(error={"code": "INVALID_SORT",
                                  "message": "Ordenação inválida."}), 400

        items = [
            p for p in PRODUCTS
            if (not q or q in f'{p["name"]} {p["description"]} {p["category"]}'.casefold())
            and (not category or p["category"] == category)
        ]
        if sort == "price-asc":
            items.sort(key=lambda p: p["price"])
        elif sort == "price-desc":
            items.sort(key=lambda p: p["price"], reverse=True)
        elif sort == "name-asc":
            items.sort(key=lambda p: p["name"].casefold())
        else:
            items.sort(key=lambda p: p["featured"])

        public_items = [{k: v for k, v in p.items() if k != "featured"} for p in items]
        return jsonify(items=public_items, total=len(public_items),
                       filters={"q": request.args.get("q", ""),
                                "category": category, "sort": sort})

    @app.get("/api/shop/products/<int:product_id>")
    def ecommerce_product_detail(product_id):
        product = _find_product(product_id)
        if product is None:
            return jsonify(error={"code": "PRODUCT_NOT_FOUND",
                                  "message": "Produto não encontrado."}), 404
        return jsonify({k: v for k, v in product.items() if k != "featured"})

    # ────────────────────────────────────────────────────────
    # CORAÇÃO DA MISSÃO 03 — o servidor é a autoridade.
    # O cliente envia apenas {id, quantity}. QUALQUER campo
    # de preço enviado é IGNORADO. Preço e estoque vêm do
    # catálogo do servidor (PRODUCTS).
    # ────────────────────────────────────────────────────────
    @app.post("/api/shop/cart/validate")
    def ecommerce_cart_validate():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify(error={"code": "INVALID_BODY",
                                  "message": "Corpo deve ser um objeto JSON."}), 400

        items = payload.get("items")
        if not isinstance(items, list) or not items:
            return jsonify(error={"code": "INVALID_ITEMS",
                                  "message": "Envie items: [{id, quantity}, ...]."}), 400

        result_items, total = [], 0.0

        for raw in items:
            if not isinstance(raw, dict):
                return jsonify(error={"code": "INVALID_ITEM",
                                      "message": "Cada item deve ser um objeto."}), 400

            pid = raw.get("id")
            qty = raw.get("quantity")

            if not isinstance(pid, int):
                return jsonify(error={"code": "INVALID_ID",
                                      "message": f"id deve ser inteiro: {pid!r}."}), 400
            if not isinstance(qty, int) or qty <= 0:
                return jsonify(error={"code": "INVALID_QUANTITY",
                                      "message": f"quantity deve ser inteiro > 0: {qty!r}."}), 400

            product = _find_product(pid)
            if product is None:
                return jsonify(error={"code": "PRODUCT_NOT_FOUND",
                                      "message": f"Produto {pid} não existe."}), 404

            if qty > product["stock"]:
                return jsonify(error={
                    "code": "OUT_OF_STOCK",
                    "message": f"Estoque insuficiente para {product['name']}.",
                    "available": product["stock"],
                    "requested": qty,
                }), 409

            unit = product["price"]                    # ← do servidor
            subtotal = round(unit * qty, 2)
            result_items.append({
                "id": product["id"],
                "name": product["name"],
                "quantity": qty,
                "unit_price": unit,
                "subtotal": subtotal,
                "stock_available": product["stock"],
            })
            total += subtotal

        return jsonify({
            "status": "validated",
            "items": result_items,
            "total": round(total, 2),
            "message": "Carrinho validado pelo servidor.",
        })
