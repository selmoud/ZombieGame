class_name SupplyDepot
extends Node2D

signal inventory_changed

const TILE_SIZE := 32

const ITEM_LABELS := {
	"wall_section": "Секции стен",
	"door_module": "Двери",
	"debris": "Обломки",
}

const ITEM_COLORS := {
	"wall_section": Color("c5c1b3"),
	"door_module": Color("b88752"),
	"debris": Color("8f7558"),
}

var _boxes: Dictionary[Vector2i, Dictionary] = {}
var _reservations: Dictionary[int, Dictionary] = {}


func _ready() -> void:
	add_box(Vector2i(29, 31), &"wall_section", 24)
	add_box(Vector2i(29, 33), &"door_module", 6)
	add_box(Vector2i(29, 35), &"debris", 12)


func add_box(cell: Vector2i, item_id: StringName, quantity: int) -> void:
	_boxes[cell] = {
		"item_id": item_id,
		"quantity": maxi(quantity, 0),
	}
	inventory_changed.emit()
	queue_redraw()


func has_box_at(cell: Vector2i) -> bool:
	return _boxes.has(cell)


func get_available_boxes(item_id: StringName) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	for cell: Vector2i in _boxes:
		if (
			_boxes[cell]["item_id"] == item_id
			and _get_available_in_box(cell) > 0
		):
			result.append(cell)
	return result


func reserve_from_box(
	cell: Vector2i,
	item_id: StringName,
	agent_id: int
) -> bool:
	if _reservations.has(agent_id):
		return false
	if (
		not _boxes.has(cell)
		or _boxes[cell]["item_id"] != item_id
		or _get_available_in_box(cell) <= 0
	):
		return false
	_reservations[agent_id] = {
		"cell": cell,
		"item_id": item_id,
	}
	return true


func has_reservation(agent_id: int) -> bool:
	return _reservations.has(agent_id)


func take_reserved_item(agent_id: int) -> StringName:
	if not _reservations.has(agent_id):
		return &""
	var reservation: Dictionary = _reservations[agent_id]
	var cell: Vector2i = reservation["cell"]
	var item_id: StringName = reservation["item_id"]
	_reservations.erase(agent_id)
	if not _boxes.has(cell) or int(_boxes[cell]["quantity"]) <= 0:
		return &""
	_boxes[cell]["quantity"] = int(_boxes[cell]["quantity"]) - 1
	inventory_changed.emit()
	queue_redraw()
	return item_id


func release_reservation(agent_id: int) -> void:
	_reservations.erase(agent_id)


func return_item_to_box(cell: Vector2i, item_id: StringName) -> void:
	if not _boxes.has(cell) or _boxes[cell]["item_id"] != item_id:
		return
	_boxes[cell]["quantity"] = int(_boxes[cell]["quantity"]) + 1
	inventory_changed.emit()
	queue_redraw()


func get_total_quantity(item_id: StringName) -> int:
	var total := 0
	for box: Dictionary in _boxes.values():
		if box["item_id"] == item_id:
			total += int(box["quantity"])
	return total


func get_summary_text() -> String:
	return "Стены: %d  •  Двери: %d  •  Обломки: %d" % [
		get_total_quantity(&"wall_section"),
		get_total_quantity(&"door_module"),
		get_total_quantity(&"debris"),
	]


static func get_item_color(item_id: StringName) -> Color:
	return ITEM_COLORS.get(String(item_id), Color.WHITE)


func _get_available_in_box(cell: Vector2i) -> int:
	if not _boxes.has(cell):
		return 0
	var reserved := 0
	for reservation: Dictionary in _reservations.values():
		if reservation["cell"] == cell:
			reserved += 1
	return int(_boxes[cell]["quantity"]) - reserved


func _draw() -> void:
	for cell: Vector2i in _boxes:
		var box: Dictionary = _boxes[cell]
		var rect := Rect2(Vector2(cell * TILE_SIZE), Vector2.ONE * TILE_SIZE)
		var item_color := get_item_color(box["item_id"])
		draw_rect(rect.grow(-3.0), Color("6f5335"), true)
		draw_rect(rect.grow(-3.0), Color("b58a59"), false, 2.0)
		draw_rect(
			Rect2(rect.position + Vector2(5, 5), Vector2(TILE_SIZE - 10, 5)),
			item_color,
			true
		)
		draw_string(
			ThemeDB.fallback_font,
			rect.position + Vector2(0, 25),
			str(box["quantity"]),
			HORIZONTAL_ALIGNMENT_CENTER,
			TILE_SIZE,
			13,
			Color.WHITE
		)
