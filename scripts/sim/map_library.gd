class_name MapLibrary
extends RefCounted
## The maps of the game and the enemy force that defends each of them.

const CITY_PICTURE := "res://assets/maps/city.png"
const CITY_TERRAIN := "res://assets/maps/city_terrain.png"
## Road and landmark positions below are in pixels of a picture this wide.
const CITY_PICTURE_WIDTH := 1254.0

const BRIDGE := 0
const SQUARE := 1
const WORKS := 2

## Main roads of the city, traced over the painted map. Vehicles move only along
## these inside the built-up area; a road that crosses the river is a bridge.
const CITY_ROADS: Array[Array] = [
	# Northern bridge and the ring road along the north edge of the city.
	[Vector2(0, 205), Vector2(100, 160), Vector2(165, 165), Vector2(305, 208), Vector2(400, 255),
			Vector2(412, 275), Vector2(500, 272), Vector2(600, 250), Vector2(705, 215),
			Vector2(900, 215), Vector2(960, 228), Vector2(1010, 252)],
	# Road in from the north.
	[Vector2(835, 0), Vector2(825, 60), Vector2(790, 120), Vector2(740, 195), Vector2(705, 215)],
	# Middle bridge and the avenue from it to the central square.
	[Vector2(0, 385), Vector2(95, 390), Vector2(215, 425), Vector2(250, 440), Vector2(380, 385),
			Vector2(500, 397), Vector2(600, 428), Vector2(688, 457)],
	# Western avenue, north to south.
	[Vector2(412, 275), Vector2(395, 340), Vector2(380, 385), Vector2(345, 470), Vector2(315, 540),
			Vector2(300, 645), Vector2(335, 740), Vector2(340, 828)],
	# Third bridge.
	[Vector2(0, 725), Vector2(100, 690), Vector2(200, 648), Vector2(300, 645)],
	# Fourth bridge and the southern edge road.
	[Vector2(0, 925), Vector2(150, 890), Vector2(310, 845), Vector2(340, 828), Vector2(450, 815),
			Vector2(520, 850), Vector2(600, 860)],
	# Central avenue, north to south, through the square.
	[Vector2(705, 215), Vector2(695, 330), Vector2(688, 457), Vector2(675, 560), Vector2(650, 660),
			Vector2(620, 760), Vector2(600, 860), Vector2(590, 940), Vector2(560, 1010),
			Vector2(640, 1100), Vector2(720, 1180), Vector2(800, 1254)],
	# Avenue from the square east to the highway.
	[Vector2(688, 457), Vector2(800, 485), Vector2(900, 512), Vector2(980, 515), Vector2(1050, 492),
			Vector2(1100, 500)],
	# Road through the works and on south along the eastern districts.
	[Vector2(900, 215), Vector2(905, 300), Vector2(910, 400), Vector2(900, 512), Vector2(915, 600),
			Vector2(930, 700), Vector2(1000, 790), Vector2(960, 860), Vector2(930, 900),
			Vector2(930, 1000), Vector2(940, 1100), Vector2(1000, 1254)],
	# Southern cross street.
	[Vector2(620, 760), Vector2(760, 800), Vector2(900, 830), Vector2(960, 860)],
	# Roads out to the east and south-east.
	[Vector2(1010, 252), Vector2(1060, 290), Vector2(1150, 300), Vector2(1254, 305)],
	[Vector2(930, 900), Vector2(1050, 1000), Vector2(1150, 1080), Vector2(1254, 1150)],
]
## The river's main channel. The terrain mask finds most of the water but leaves
## gaps at ripples and sandbanks; this line closes them so that the river can only
## be crossed by a bridge.
const CITY_RIVER: Array[Array] = [
	[Vector2(345, 0), Vector2(330, 110), Vector2(260, 185), Vector2(165, 250), Vector2(130, 330),
			Vector2(118, 420), Vector2(110, 520), Vector2(130, 600), Vector2(190, 690),
			Vector2(245, 790), Vector2(285, 880), Vector2(325, 960), Vector2(318, 1050),
			Vector2(325, 1150), Vector2(335, 1254)],
	[Vector2(150, 0), Vector2(180, 90), Vector2(230, 165), Vector2(260, 185)],
]
## The highway east of the city; the terrain mask sees its lane markings as roofs.
const CITY_HIGHWAY: Array[Vector2] = [
	Vector2(975, 0), Vector2(990, 150), Vector2(1010, 252), Vector2(1055, 400), Vector2(1100, 500),
	Vector2(1150, 600), Vector2(1195, 700), Vector2(1240, 800), Vector2(1254, 830),
]


## The painted desert city: the player comes from the west bank, the river with its
## bridges lies between him and the three objectives.
static func create_city() -> BattleMap:
	var texture: Texture2D = load(CITY_TERRAIN)
	var map := BattleMap.from_mask(texture.get_image())
	map.background = CITY_PICTURE
	var cell := map.size.x / CITY_PICTURE_WIDTH
	for channel: Array in CITY_RIVER:
		var course: Array[Vector2] = []
		course.assign(channel)
		map.paint_line(_to_cells(course, cell), Terrain.Type.WATER, 1)
	map.paint_road(_to_cells(CITY_HIGHWAY, cell), 1)
	for road: Array in CITY_ROADS:
		var points: Array[Vector2] = []
		points.assign(road)
		map.paint_road(_to_cells(points, cell))

	map.add_objective("Мост", Vector2i((Vector2(250, 440) * cell).floor()))
	map.add_objective("Площадь", Vector2i((Vector2(688, 457) * cell).floor()))
	map.add_objective("Завод", Vector2i((Vector2(908, 400) * cell).floor()))
	map.player_base = Vector2i((Vector2(40, 387) * cell).floor())
	map.enemy_base = Vector2i((Vector2(1225, 304) * cell).floor())
	return map


## The enemy force differs from mission to mission: which objective is held in strength,
## where the patrol walks and what waits in reserve are drawn from the mission's seed.
static func place_city_enemy(battle: Battle, rng: RandomNumberGenerator) -> void:
	var map := battle.map
	var strongpoint := rng.randi_range(1, 2)
	for objective in map.objectives:
		# Garrisons sit among the buildings next to the objective, not on the road through it.
		# Two squads hold each objective from opposite sides of it.
		var post := map.nearest_terrain(objective.cell + Vector2i(-1, -1), Terrain.Type.TOWN)
		_add_garrison(battle, UnitKind.Type.RIFLE, post)
		var second := map.nearest_terrain(objective.cell + Vector2i(2, 2), Terrain.Type.TOWN)
		_add_garrison(battle, UnitKind.Type.RIFLE, second)
		if objective.index != strongpoint:
			continue
		if rng.randf() < 0.5:
			# A vehicle cannot stand among the houses; it holds the road.
			_add_garrison(battle, UnitKind.Type.APC, objective.cell)
		else:
			var third := map.nearest_terrain(objective.cell + Vector2i(-2, 2), Terrain.Type.TOWN)
			_add_garrison(battle, UnitKind.Type.RIFLE, third)

	var cell := map.size.x / CITY_PICTURE_WIDTH
	var routes: Array[Array] = [
		[Vector2(450, 420), Vector2(688, 457), Vector2(900, 512)],
		[Vector2(600, 270), Vector2(688, 457), Vector2(650, 660)],
		[Vector2(908, 400), Vector2(900, 600), Vector2(650, 660)],
	]
	var route: Array = routes[rng.randi_range(0, routes.size() - 1)]
	var points: Array[Vector2] = []
	points.assign(route)
	var patrol_cells := _to_cells(points, cell)
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


static func _to_cells(points: Array[Vector2], cell: float) -> Array[Vector2i]:
	var cells: Array[Vector2i] = []
	for point in points:
		cells.append(Vector2i((point * cell).floor()))
	return cells
