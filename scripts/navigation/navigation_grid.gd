class_name NavigationGrid
extends Node

const TILE_SIZE := WorldConfig.TILE_SIZE
const MAP_SIZE := WorldConfig.MAP_SIZE
const NEIGHBORS: Array[Vector2i] = [
	Vector2i.LEFT,
	Vector2i.RIGHT,
	Vector2i.UP,
	Vector2i.DOWN,
	Vector2i(-1, -1),
	Vector2i(1, -1),
	Vector2i(-1, 1),
	Vector2i(1, 1),
]

var _grid := AStarGrid2D.new()


func _ready() -> void:
	_grid.region = Rect2i(Vector2i.ZERO, MAP_SIZE)
	_grid.cell_size = Vector2.ONE * TILE_SIZE
	_grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	_grid.update()


func find_path_to_adjacent(from: Vector2i, target: Vector2i) -> Array[Vector2i]:
	var best_path: Array[Vector2i] = []
	for offset in NEIGHBORS:
		var candidate := target + offset
		if not is_cell_walkable(candidate):
			continue
		var path := get_cell_path(from, candidate)
		if path.is_empty():
			continue
		if best_path.is_empty() or path.size() < best_path.size():
			best_path = path
	return best_path


func get_cell_path(from: Vector2i, to: Vector2i) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	if not is_cell_walkable(from) or not is_cell_walkable(to):
		return result
	var id_path := _grid.get_id_path(from, to)
	result.assign(id_path)
	return result


func register_construction(cell: Vector2i, object_id: StringName) -> void:
	var blocks_movement := object_id == &"wall" or object_id == &"barricade"
	_grid.set_point_solid(cell, blocks_movement)


func remove_construction(cell: Vector2i, _object_id: StringName = &"") -> void:
	_grid.set_point_solid(cell, false)


func is_cell_walkable(cell: Vector2i) -> bool:
	return (
		cell.x >= 0
		and cell.y >= 0
		and cell.x < MAP_SIZE.x
		and cell.y < MAP_SIZE.y
		and not _grid.is_point_solid(cell)
	)


func world_to_cell(world_position: Vector2) -> Vector2i:
	return Vector2i(floori(world_position.x / TILE_SIZE), floori(world_position.y / TILE_SIZE))


func cell_to_world(cell: Vector2i) -> Vector2:
	return Vector2(cell * TILE_SIZE) + Vector2.ONE * TILE_SIZE * 0.5
