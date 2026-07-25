class_name WorldGrid
extends Node2D

const TILE_SIZE := 32
const MAP_SIZE := Vector2i(64, 64)
const WORLD_SIZE := Vector2(MAP_SIZE * TILE_SIZE)

const GROUND_COLOR := Color("485b3b")
const GRID_COLOR := Color(0.13, 0.17, 0.12, 0.28)
const WATER_COLOR := Color("36576a")
const ROAD_COLOR := Color("555650")
const BUILDING_COLOR := Color("747169")
const BUILDING_INNER_COLOR := Color("393b38")
const LANDING_COLOR := Color(0.82, 0.76, 0.38, 0.13)


func _ready() -> void:
	queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, WORLD_SIZE), GROUND_COLOR)
	_draw_test_terrain()
	_draw_grid()
	draw_rect(
		Rect2(Vector2(25, 25) * TILE_SIZE, Vector2(14, 14) * TILE_SIZE),
		LANDING_COLOR,
		true
	)


func _draw_test_terrain() -> void:
	# Водоём на западной окраине.
	var water_polygon := PackedVector2Array([
		Vector2(0, 0),
		Vector2(13, 0),
		Vector2(11, 10),
		Vector2(14, 21),
		Vector2(9, 34),
		Vector2(12, 48),
		Vector2(7, 64),
		Vector2(0, 64),
	])
	for index in water_polygon.size():
		water_polygon[index] *= TILE_SIZE
	draw_colored_polygon(water_polygon, WATER_COLOR)

	# Старая дорога и несколько видимых на карте зданий.
	draw_rect(
		Rect2(Vector2(0, 43) * TILE_SIZE, Vector2(64, 5) * TILE_SIZE),
		ROAD_COLOR
	)
	draw_rect(
		Rect2(Vector2(44, 0) * TILE_SIZE, Vector2(5, 64) * TILE_SIZE),
		ROAD_COLOR
	)
	_draw_building(Rect2i(17, 8, 10, 7))
	_draw_building(Rect2i(51, 7, 9, 11))
	_draw_building(Rect2i(17, 51, 14, 9))
	_draw_building(Rect2i(51, 51, 8, 7))


func _draw_building(tile_rect: Rect2i) -> void:
	var rect := Rect2(
		Vector2(tile_rect.position) * TILE_SIZE,
		Vector2(tile_rect.size) * TILE_SIZE
	)
	draw_rect(rect, BUILDING_COLOR)
	draw_rect(rect.grow(-TILE_SIZE), BUILDING_INNER_COLOR)


func _draw_grid() -> void:
	for x in range(MAP_SIZE.x + 1):
		var offset := float(x * TILE_SIZE)
		draw_line(Vector2(offset, 0), Vector2(offset, WORLD_SIZE.y), GRID_COLOR)
	for y in range(MAP_SIZE.y + 1):
		var offset := float(y * TILE_SIZE)
		draw_line(Vector2(0, offset), Vector2(WORLD_SIZE.x, offset), GRID_COLOR)
