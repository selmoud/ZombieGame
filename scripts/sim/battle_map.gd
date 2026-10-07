class_name BattleMap
extends RefCounted
## Terrain grid with objectives and start zones. Finds routes for each kind of mover.
## Positions are in cell units: the centre of cell (3, 5) is Vector2(3.5, 5.5).

## One map square of the coordinate grid is this many cells wide and high.
const SQUARE_CELLS := 6
const SQUARE_LETTERS := "АБВГДЕЖЗИКЛМНОПР"
## Speed multiplier of a vehicle on open ground it is allowed to drive on.
const OFF_ROAD_SPEED := 1.0


class Objective:
	var index: int
	var title: String
	var cell: Vector2i


var size: Vector2i
var objectives: Array[Objective] = []
## Roads as the lines they were laid along, in cell units.
var roads: Array[PackedVector2Array] = []
## Painted picture of the map that the screen shows under the units; "" for none.
var background := ""
## How many cells make one unit of distance in the rules. Speeds, sight and weapon
## ranges are given in these units, so a finely gridded map plays like a coarse one.
var unit := 1.0
## Where the player's units arrive.
var player_base: Vector2i
## Where enemy reinforcements arrive.
var enemy_base: Vector2i

var _cells := PackedByteArray()
## Where vehicles may drive, one byte per cell; empty when the map has no such
## layer and vehicles simply follow the terrain table.
var _drivable := PackedByteArray()
var _grids: Dictionary[Terrain.Mover, AStarGrid2D] = {}


func _init(map_size: Vector2i) -> void:
	size = map_size
	_cells.resize(size.x * size.y)
	_cells.fill(Terrain.Type.FIELD)


## Builds a map from a terrain mask: one pixel per cell, coloured as
## tools/make_terrain_mask.py writes it.
static func from_mask(mask: Image) -> BattleMap:
	var image := mask.duplicate() as Image
	if image.is_compressed():
		image.decompress()
	image.convert(Image.FORMAT_RGB8)
	var map := BattleMap.new(image.get_size())
	var data := image.get_data()
	for i in map.size.x * map.size.y:
		var red := data[i * 3] > 127
		var green := data[i * 3 + 1] > 127
		var blue := data[i * 3 + 2] > 127
		var type := Terrain.Type.FIELD
		if red and green and blue:
			type = Terrain.Type.ROAD
		elif red and green:
			type = Terrain.Type.HILL
		elif red and blue:
			type = Terrain.Type.TOWN
		elif green and blue:
			type = Terrain.Type.BRIDGE
		elif red:
			type = Terrain.Type.BUILDING
		elif green:
			type = Terrain.Type.FOREST
		elif blue:
			type = Terrain.Type.WATER
		map._cells[i] = type
	return map


## Closest cell of the given terrain within the radius, or the cell itself if none.
func nearest_terrain(cell: Vector2i, type: Terrain.Type, max_radius: int = 4) -> Vector2i:
	var best := cell
	var best_distance := INF
	for y in range(cell.y - max_radius, cell.y + max_radius + 1):
		for x in range(cell.x - max_radius, cell.x + max_radius + 1):
			var candidate := Vector2i(x, y)
			if not contains(candidate) or get_terrain(candidate) != type:
				continue
			var distance := Vector2(candidate - cell).length()
			if distance < best_distance:
				best_distance = distance
				best = candidate
	return best


func contains(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < size.x and cell.y < size.y


func get_terrain(cell: Vector2i) -> Terrain.Type:
	if not contains(cell):
		return Terrain.Type.WATER
	return _cells[cell.y * size.x + cell.x] as Terrain.Type


func set_terrain(cell: Vector2i, type: Terrain.Type) -> void:
	if contains(cell):
		_cells[cell.y * size.x + cell.x] = type
		_grids.clear()


func terrain_at(position: Vector2) -> Terrain.Type:
	return get_terrain(Vector2i(position.floor()))


func is_passable(cell: Vector2i, mover: Terrain.Mover) -> bool:
	return contains(cell) and speed_in(cell, mover) > 0.0


## Speed multiplier of the mover in the cell; 0 when it cannot enter.
func speed_in(cell: Vector2i, mover: Terrain.Mover) -> float:
	var type := get_terrain(cell)
	if mover != Terrain.Mover.VEHICLE or _drivable.is_empty():
		return Terrain.speed(type, mover)
	# With a vehicle layer the layer decides where vehicles go, and the terrain
	# only how fast: full speed on a road, slower off it.
	if not contains(cell) or _drivable[cell.y * size.x + cell.x] == 0:
		return 0.0
	match type:
		Terrain.Type.ROAD, Terrain.Type.BRIDGE:
			return Terrain.speed(type, mover)
		Terrain.Type.WATER, Terrain.Type.BUILDING:
			return 0.0
		Terrain.Type.FOREST, Terrain.Type.HILL:
			return OFF_ROAD_SPEED * 0.5
	return OFF_ROAD_SPEED


func speed_at(position: Vector2, mover: Terrain.Mover) -> float:
	return speed_in(Vector2i(position.floor()), mover)


func is_drivable(cell: Vector2i) -> bool:
	return is_passable(cell, Terrain.Mover.VEHICLE)


## Sets where vehicles may drive from a picture with one pixel per cell:
## light pixels are open to vehicles, dark ones are not.
func set_drivable(layer: Image) -> void:
	var image := layer.duplicate() as Image
	if image.is_compressed():
		image.decompress()
	image.convert(Image.FORMAT_L8)
	if image.get_size() != size:
		image.resize(size.x, size.y, Image.INTERPOLATE_NEAREST)
	var data := image.get_data()
	_drivable.resize(size.x * size.y)
	for i in _drivable.size():
		_drivable[i] = 1 if data[i] > 127 else 0
	_grids.clear()


static func cell_centre(cell: Vector2i) -> Vector2:
	return Vector2(cell) + Vector2(0.5, 0.5)


## Name of the map square, like "В4", used in radio reports.
func square_name(position: Vector2) -> String:
	var square := SQUARE_CELLS * unit
	var column := clampi(int(position.x / square), 0, SQUARE_LETTERS.length() - 1)
	var row := int(position.y / square) + 1
	return "%s%d" % [SQUARE_LETTERS[column], row]


## Closest cell the mover can stand on, searching outwards in rings; (-1, -1) if none.
func nearest_passable(cell: Vector2i, mover: Terrain.Mover, max_radius: int = 8) -> Vector2i:
	if is_passable(cell, mover):
		return cell
	for radius in range(1, max_radius + 1):
		var best := Vector2i(-1, -1)
		var best_distance := INF
		for y in range(cell.y - radius, cell.y + radius + 1):
			for x in range(cell.x - radius, cell.x + radius + 1):
				var candidate := Vector2i(x, y)
				if maxi(absi(x - cell.x), absi(y - cell.y)) != radius:
					continue
				if not is_passable(candidate, mover):
					continue
				var distance := Vector2(candidate - cell).length()
				if distance < best_distance:
					best_distance = distance
					best = candidate
		if best.x >= 0:
			return best
	return Vector2i(-1, -1)


## Cell centres from the first step to the destination; empty when there is no way.
func find_path(from: Vector2i, to: Vector2i, mover: Terrain.Mover) -> PackedVector2Array:
	if not is_passable(from, mover) or not is_passable(to, mover):
		return PackedVector2Array()
	var cells := _grid(mover).get_id_path(from, to)
	var path := PackedVector2Array()
	for i in range(1, cells.size()):
		path.append(cell_centre(cells[i]))
	return path


func _grid(mover: Terrain.Mover) -> AStarGrid2D:
	if _grids.has(mover):
		return _grids[mover]
	var grid := AStarGrid2D.new()
	grid.region = Rect2i(Vector2i.ZERO, size)
	grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	grid.update()
	for y in size.y:
		for x in size.x:
			var cell := Vector2i(x, y)
			var speed := speed_in(cell, mover)
			if speed <= 0.0:
				grid.set_point_solid(cell, true)
			else:
				grid.set_point_weight_scale(cell, 1.0 / speed)
	_grids[mover] = grid
	return grid


func add_objective(title: String, cell: Vector2i) -> void:
	var objective := Objective.new()
	objective.index = objectives.size()
	objective.title = title
	objective.cell = cell
	objectives.append(objective)


func paint_rect(rect: Rect2i, type: Terrain.Type) -> void:
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			set_terrain(Vector2i(x, y), type)


func paint_blob(centre: Vector2, radius: Vector2, type: Terrain.Type) -> void:
	for y in range(floori(centre.y - radius.y), ceili(centre.y + radius.y) + 1):
		for x in range(floori(centre.x - radius.x), ceili(centre.x + radius.x) + 1):
			var offset := (Vector2(x, y) + Vector2(0.5, 0.5) - centre) / radius
			if offset.length_squared() <= 1.0:
				set_terrain(Vector2i(x, y), type)


## Paints a band of terrain along the line through the points, `radius` cells to each side.
func paint_line(points: Array[Vector2i], type: Terrain.Type, radius: int) -> void:
	for i in range(1, points.size()):
		var from := points[i - 1]
		var to := points[i]
		var steps := maxi(absi(to.x - from.x), absi(to.y - from.y))
		for step in steps + 1:
			var cell := Vector2i((Vector2(from).lerp(Vector2(to), float(step) / maxf(steps, 1.0))).round())
			for dy in range(-radius, radius + 1):
				for dx in range(-radius, radius + 1):
					set_terrain(cell + Vector2i(dx, dy), type)


## Paints a line of cells through the points. A road over water becomes a bridge.
## `half_width` widens the road by this many cells to each side; `verge` clears
## the ground between houses beyond that.
func paint_road(points: Array[Vector2i], verge: int = 0, half_width: int = 0) -> void:
	var line := PackedVector2Array()
	for point in points:
		line.append(cell_centre(point))
	roads.append(line)
	for i in range(1, points.size()):
		var from := points[i - 1]
		var to := points[i]
		var steps := maxi(absi(to.x - from.x), absi(to.y - from.y))
		var previous := from
		for step in steps + 1:
			var cell := Vector2i((Vector2(from).lerp(Vector2(to), float(step) / maxf(steps, 1.0))).round())
			# Fill the corner of a diagonal step so vehicles are never forced off the road.
			if cell.x != previous.x and cell.y != previous.y:
				_paint_road_cell(Vector2i(cell.x, previous.y))
			for dy in range(-half_width, half_width + 1):
				for dx in range(-half_width, half_width + 1):
					_paint_road_cell(cell + Vector2i(dx, dy))
			for dy in range(-verge, verge + 1):
				for dx in range(-verge, verge + 1):
					if get_terrain(cell + Vector2i(dx, dy)) == Terrain.Type.TOWN:
						set_terrain(cell + Vector2i(dx, dy), Terrain.Type.FIELD)
			previous = cell


func _paint_road_cell(cell: Vector2i) -> void:
	if not contains(cell):
		return
	# On a map with a vehicle layer a road is laid only where vehicles may drive,
	# so a line traced a little off never runs over a house.
	if not _drivable.is_empty() and _drivable[cell.y * size.x + cell.x] == 0:
		return
	var water := get_terrain(cell) == Terrain.Type.WATER or get_terrain(cell) == Terrain.Type.BRIDGE
	set_terrain(cell, Terrain.Type.BRIDGE if water else Terrain.Type.ROAD)
