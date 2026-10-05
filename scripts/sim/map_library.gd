class_name MapLibrary
extends RefCounted
## Hand-made maps and the enemy force that defends each of them.

const BRIDGE_TOWN := 0
const HILL := 1
const VILLAGE := 2


## 60x42 cells: the player comes from the west, a river with two bridges cuts the map,
## the three objectives lie beyond it.
static func create_valley() -> BattleMap:
	var map := BattleMap.new(Vector2i(60, 42))
	var forest := Terrain.Type.FOREST
	var hill := Terrain.Type.HILL
	var water := Terrain.Type.WATER
	var town := Terrain.Type.TOWN

	map.paint_blob(Vector2(10, 7), Vector2(6, 4), forest)
	map.paint_blob(Vector2(8, 34), Vector2(5, 4), forest)
	map.paint_blob(Vector2(16, 27), Vector2(3, 2.5), forest)
	map.paint_blob(Vector2(33, 17), Vector2(4.5, 4), forest)
	map.paint_blob(Vector2(31, 36), Vector2(6, 3), forest)
	map.paint_blob(Vector2(52, 8), Vector2(5, 4.5), forest)
	map.paint_blob(Vector2(45, 27), Vector2(3, 2.5), forest)
	map.paint_blob(Vector2(38, 3), Vector2(4, 2), forest)

	map.paint_blob(Vector2(14, 17), Vector2(3, 2.5), hill)
	map.paint_blob(Vector2(41, 21), Vector2(4.5, 3.5), hill)
	map.paint_blob(Vector2(56, 27), Vector2(3, 4), hill)

	for y in map.size.y:
		var x := 22 + roundi(1.6 * sin(y / 5.0))
		map.paint_rect(Rect2i(x, y, 2, 1), water)
	map.paint_blob(Vector2(23, 20), Vector2(3.5, 3), water)

	map.paint_rect(Rect2i(26, 7, 6, 5), town)
	map.paint_rect(Rect2i(47, 30, 8, 6), town)
	map.paint_rect(Rect2i(36, 12, 3, 2), town)

	map.paint_road([Vector2i(0, 21), Vector2i(10, 21), Vector2i(17, 9), Vector2i(40, 9)])
	map.paint_road([Vector2i(10, 21), Vector2i(17, 31), Vector2i(36, 31), Vector2i(47, 33), Vector2i(54, 33)])
	map.paint_road([Vector2i(40, 9), Vector2i(48, 15), Vector2i(50, 30), Vector2i(50, 35)])
	map.paint_road([Vector2i(40, 9), Vector2i(40, 17)])
	map.paint_road([Vector2i(49, 20), Vector2i(59, 20)])

	map.add_objective("Переправа", Vector2i(29, 9))
	map.add_objective("Высота 112", Vector2i(41, 21))
	map.add_objective("Посёлок", Vector2i(50, 33))
	map.player_base = Vector2i(3, 21)
	map.enemy_base = Vector2i(57, 20)
	return map


static func place_valley_enemy(battle: Battle) -> void:
	# Garrisons sit in cover next to the objective, not on the road through it.
	var posts: Array[Vector2i] = [Vector2i(28, 8), Vector2i(41, 21), Vector2i(51, 32)]
	for post in posts:
		var garrison := battle.add_unit(BattleUnit.Side.ENEMY, UnitKind.Type.RIFLE, post)
		garrison.role = BattleUnit.Role.GARRISON
		garrison.home_cell = post

	var patrol := battle.add_unit(BattleUnit.Side.ENEMY, UnitKind.Type.RIFLE, Vector2i(36, 31))
	patrol.role = BattleUnit.Role.PATROL
	patrol.patrol = [Vector2i(36, 31), Vector2i(40, 12), Vector2i(48, 16)]

	var reserve := battle.add_unit(BattleUnit.Side.ENEMY, UnitKind.Type.APC, battle.map.enemy_base)
	reserve.role = BattleUnit.Role.RESERVE
