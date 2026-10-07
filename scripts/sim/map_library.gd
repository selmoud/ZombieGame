class_name MapLibrary
extends RefCounted
## The maps of the game and the enemy force that defends each of them.

const CITY_PICTURE := "res://assets/maps/city.png"
const CITY_TERRAIN := "res://assets/maps/city_terrain.png"
## Road and landmark positions below are in pixels of a picture this wide.
const CITY_PICTURE_WIDTH := 1254.0
## The rules measure distances in units; the map is this many units across.
const CITY_UNITS_ACROSS := 84.0
## Half the width of a main road, in pixels of the picture.
const CITY_ROAD_HALF_WIDTH := 5.0

const BRIDGE := 0
const SQUARE := 1
const ROUNDABOUT := 2

## Main roads of the city, traced over the painted map. Vehicles move only along
## these; a road that crosses the river is a bridge. Infantry is not tied to them.
const CITY_ROADS: Array[Array] = [
	# North bridge road, west edge to the northern junction.
	[Vector2(0, 120), Vector2(60, 155), Vector2(150, 185), Vector2(250, 198), Vector2(345, 203),
			Vector2(455, 222), Vector2(500, 225), Vector2(530, 238)],
	# Road in from the north-west along the river.
	[Vector2(455, 0), Vector2(470, 60), Vector2(500, 150), Vector2(522, 225), Vector2(530, 238)],
	# Western avenue and the ring along the south of the city.
	[Vector2(530, 238), Vector2(510, 300), Vector2(480, 380), Vector2(468, 460), Vector2(465, 520),
			Vector2(470, 600), Vector2(500, 657), Vector2(505, 727), Vector2(540, 792),
			Vector2(590, 852), Vector2(627, 872), Vector2(702, 887), Vector2(777, 897),
			Vector2(877, 887), Vector2(942, 877)],
	# Diagonal from the northern junction to the eastern roundabout.
	[Vector2(530, 238), Vector2(560, 270), Vector2(627, 310), Vector2(692, 330), Vector2(752, 370),
			Vector2(842, 430), Vector2(892, 480), Vector2(914, 525)],
	# Middle bridge road, west edge to the western avenue.
	[Vector2(0, 410), Vector2(60, 450), Vector2(120, 490), Vector2(180, 518), Vector2(300, 520),
			Vector2(400, 520), Vector2(465, 520)],
	[Vector2(0, 590), Vector2(60, 570), Vector2(130, 540), Vector2(180, 518)],
	# From the western avenue to the central square.
	[Vector2(465, 520), Vector2(520, 535), Vector2(600, 552), Vector2(640, 585), Vector2(655, 620)],
	# North road down to the square.
	[Vector2(724, 0), Vector2(722, 50), Vector2(707, 200), Vector2(692, 330), Vector2(690, 420),
			Vector2(700, 500), Vector2(690, 560), Vector2(668, 600), Vector2(655, 620)],
	# Square south to the ring and out of the city.
	[Vector2(655, 620), Vector2(668, 650), Vector2(688, 660), Vector2(690, 740), Vector2(702, 802),
			Vector2(702, 887), Vector2(700, 1000), Vector2(700, 1254)],
	# Square east to the roundabout.
	[Vector2(655, 620), Vector2(700, 648), Vector2(760, 630), Vector2(830, 580), Vector2(890, 540),
			Vector2(914, 525)],
	# South-west bridge road.
	[Vector2(0, 937), Vector2(100, 887), Vector2(200, 827), Vector2(260, 787), Vector2(350, 752),
			Vector2(370, 747), Vector2(465, 724), Vector2(505, 727)],
	# South bridge road.
	[Vector2(280, 967), Vector2(360, 1002), Vector2(385, 1010), Vector2(490, 1027),
			Vector2(530, 1037), Vector2(550, 1017), Vector2(565, 952), Vector2(590, 852)],
	# North-east road.
	[Vector2(1254, 150), Vector2(1177, 200), Vector2(1097, 255), Vector2(1027, 320),
			Vector2(1000, 350), Vector2(1002, 400), Vector2(1007, 475), Vector2(1010, 510)],
	# East road through the roundabout.
	[Vector2(914, 525), Vector2(1007, 515), Vector2(1127, 505), Vector2(1254, 475)],
	# South-east roads.
	[Vector2(914, 525), Vector2(960, 580), Vector2(997, 627), Vector2(1027, 677), Vector2(1102, 762),
			Vector2(1177, 827), Vector2(1254, 872)],
	[Vector2(997, 627), Vector2(997, 752), Vector2(977, 792), Vector2(952, 867), Vector2(942, 877),
			Vector2(1002, 952), Vector2(1077, 1052), Vector2(1152, 1127), Vector2(1254, 1202)],
]

## The city map is the same for every mission and slow to build, so it is built once.
static var _city: BattleMap


## The painted desert city: the player comes from the west bank, the river with its
## bridges lies between him and the three objectives. Pass `fresh` to get a copy that
## may be changed without affecting other missions.
static func create_city(fresh: bool = false) -> BattleMap:
	if _city != null and not fresh:
		return _city
	var texture: Texture2D = load(CITY_TERRAIN)
	var map := BattleMap.from_mask(texture.get_image())
	map.background = CITY_PICTURE
	map.unit = map.size.x / CITY_UNITS_ACROSS
	var cell := map.size.x / CITY_PICTURE_WIDTH
	var half_width := maxi(roundi(CITY_ROAD_HALF_WIDTH * cell), 1)
	for road: Array in CITY_ROADS:
		var points: Array[Vector2] = []
		points.assign(road)
		map.paint_road(_to_cells(map, points), 0, half_width)

	map.add_objective("Мост", _to_cell(map, Vector2(465, 520)))
	map.add_objective("Площадь", _to_cell(map, Vector2(655, 620)))
	map.add_objective("Кольцо", _to_cell(map, Vector2(914, 525)))
	map.player_base = _to_cell(map, Vector2(120, 490))
	map.enemy_base = _to_cell(map, Vector2(1200, 488))
	if not fresh:
		_city = map
	return map


## The enemy force differs from mission to mission: which objective is held in strength,
## where the patrol walks and what waits in reserve are drawn from the mission's seed.
static func place_city_enemy(battle: Battle, rng: RandomNumberGenerator) -> void:
	var map := battle.map
	var reach := roundi(4.0 * map.unit)
	var step := roundi(2.0 * map.unit)
	var strongpoint := rng.randi_range(1, 2)
	for objective in map.objectives:
		# Two squads hold each objective from the yards on opposite sides of it.
		var post := map.nearest_terrain(objective.cell + Vector2i(-step, -step), Terrain.Type.TOWN, reach)
		_add_garrison(battle, UnitKind.Type.RIFLE, post)
		var second := map.nearest_terrain(objective.cell + Vector2i(step, step), Terrain.Type.TOWN, reach)
		_add_garrison(battle, UnitKind.Type.RIFLE, second)
		if objective.index != strongpoint:
			continue
		if rng.randf() < 0.5:
			# A vehicle cannot stand among the houses; it holds the road.
			_add_garrison(battle, UnitKind.Type.APC, objective.cell)
		else:
			var third := map.nearest_terrain(objective.cell + Vector2i(-step, step), Terrain.Type.TOWN, reach)
			_add_garrison(battle, UnitKind.Type.RIFLE, third)

	var routes: Array[Array] = [
		[Vector2(560, 330), Vector2(655, 620), Vector2(800, 800)],
		[Vector2(700, 300), Vector2(914, 525), Vector2(760, 630)],
		[Vector2(505, 727), Vector2(655, 620), Vector2(914, 525)],
	]
	var route: Array = routes[rng.randi_range(0, routes.size() - 1)]
	var points: Array[Vector2] = []
	points.assign(route)
	var patrol_cells := _to_cells(map, points)
	var patrol := battle.add_unit(BattleUnit.Side.ENEMY, UnitKind.Type.RIFLE, patrol_cells[0])
	patrol.role = BattleUnit.Role.PATROL
	patrol.patrol = patrol_cells

	var reserve_kind := UnitKind.Type.APC if rng.randf() < 0.5 else UnitKind.Type.RIFLE
	var reserve := battle.add_unit(BattleUnit.Side.ENEMY, reserve_kind, map.enemy_base)
	reserve.role = BattleUnit.Role.RESERVE


static func _add_garrison(battle: Battle, kind: UnitKind.Type, post: Vector2i) -> void:
	var garrison := battle.add_unit(BattleUnit.Side.ENEMY, kind, post)
	garrison.role = BattleUnit.Role.GARRISON
	garrison.home_cell = post


## Cell under a point given in pixels of the picture.
static func _to_cell(map: BattleMap, point: Vector2) -> Vector2i:
	return Vector2i((point * (map.size.x / CITY_PICTURE_WIDTH)).floor())


static func _to_cells(map: BattleMap, points: Array[Vector2]) -> Array[Vector2i]:
	var cells: Array[Vector2i] = []
	for point in points:
		cells.append(_to_cell(map, point))
	return cells
