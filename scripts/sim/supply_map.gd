class_name SupplyMap
extends RefCounted
## Graph of the theatre: depot, junctions, front-line companies and roads between them.

enum Kind { DEPOT, HUB, COMPANY }

const DEPOT := 0
const MAX_ROUTE_LEGS := 3


class MapNode:
	var id: int
	var title: String
	var kind: Kind
	## Position on the map in 0..1 coordinates; the screen scales it.
	var position: Vector2


class Road:
	var id: int
	var a: int
	var b: int
	var risky: bool


var nodes: Array[MapNode] = []
var roads: Array[Road] = []


static func create_default() -> SupplyMap:
	var map := SupplyMap.new()
	map._add_node("Склад", Kind.DEPOT, Vector2(0.08, 0.5))
	map._add_node("Северный узел", Kind.HUB, Vector2(0.45, 0.24))
	map._add_node("Южный узел", Kind.HUB, Vector2(0.45, 0.76))
	map._add_node("1-я рота", Kind.COMPANY, Vector2(0.86, 0.1))
	map._add_node("2-я рота", Kind.COMPANY, Vector2(0.86, 0.37))
	map._add_node("3-я рота", Kind.COMPANY, Vector2(0.86, 0.63))
	map._add_node("4-я рота", Kind.COMPANY, Vector2(0.86, 0.9))
	map._add_road(0, 1, false)
	map._add_road(0, 2, false)
	map._add_road(1, 3, false)
	map._add_road(1, 4, false)
	map._add_road(2, 5, false)
	map._add_road(2, 6, false)
	map._add_road(0, 4, true)
	map._add_road(0, 5, true)
	map._add_road(3, 4, true)
	map._add_road(4, 5, true)
	map._add_road(5, 6, true)
	return map


func get_company_ids() -> PackedInt32Array:
	var ids: PackedInt32Array = []
	for node in nodes:
		if node.kind == Kind.COMPANY:
			ids.append(node.id)
	return ids


func other_end(road_id: int, from: int) -> int:
	var road := roads[road_id]
	return road.b if road.a == from else road.a


## Returns -1 when the road does not touch the node.
func step(road_id: int, from: int) -> int:
	if road_id < 0 or road_id >= roads.size():
		return -1
	var road := roads[road_id]
	if road.a != from and road.b != from:
		return -1
	return other_end(road_id, from)


func count_risky(route: PackedInt32Array) -> int:
	var count := 0
	for road_id in route:
		if roads[road_id].risky:
			count += 1
	return count


## All simple paths between two nodes up to MAX_ROUTE_LEGS, shortest and safest first.
func find_routes(from: int, to: int) -> Array[PackedInt32Array]:
	var found: Array[PackedInt32Array] = []
	_search(from, to, PackedInt32Array(), PackedInt32Array([from]), found)
	found.sort_custom(_is_better_route)
	return found


func _is_better_route(left: PackedInt32Array, right: PackedInt32Array) -> bool:
	if left.size() != right.size():
		return left.size() < right.size()
	return count_risky(left) < count_risky(right)


func _search(
	at: int,
	to: int,
	route: PackedInt32Array,
	visited: PackedInt32Array,
	found: Array[PackedInt32Array]
) -> void:
	if at == to:
		found.append(route.duplicate())
		return
	if route.size() >= MAX_ROUTE_LEGS:
		return
	for road in roads:
		var next := step(road.id, at)
		if next < 0 or visited.has(next):
			continue
		route.append(road.id)
		visited.append(next)
		_search(next, to, route, visited, found)
		route.remove_at(route.size() - 1)
		visited.remove_at(visited.size() - 1)


func _add_node(title: String, kind: Kind, position: Vector2) -> void:
	var node := MapNode.new()
	node.id = nodes.size()
	node.title = title
	node.kind = kind
	node.position = position
	nodes.append(node)


func _add_road(a: int, b: int, risky: bool) -> void:
	var road := Road.new()
	road.id = roads.size()
	road.a = a
	road.b = b
	road.risky = risky
	roads.append(road)
