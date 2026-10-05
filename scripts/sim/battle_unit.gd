class_name BattleUnit
extends RefCounted
## One unit of either side: a squad or a vehicle shown as a single map symbol.

enum Side { PLAYER, ENEMY }
enum Order { HOLD, MOVE, CAPTURE, RETREAT, EMBARK }
## What an enemy unit does when left to itself.
enum Role { NONE, GARRISON, PATROL, RESERVE }

var id: int
var side: BattleUnit.Side
var kind: UnitKind.Type
var call_sign: String
var position: Vector2
var strength: int
var alive := true

var order: BattleUnit.Order = BattleUnit.Order.HOLD
var path := PackedVector2Array()
var path_index := 0
## Objective of a CAPTURE order.
var objective := -1
## Carrier the unit walks to under an EMBARK order.
var embark_target := -1
## True when a MOVE order was given with the enemy already close: do not stop for it.
var push := false

## Carrier the unit is riding in, or -1.
var carrier := -1
## Unit riding in this carrier, or -1.
var passenger := -1

## Unit this one is shooting at, or -1.
var target := -1
var fired_at := -100.0
var hit_at := -100.0
## Damage not yet turned into a loss of strength.
var damage := 0.0
## Time spent resting at the base since the last man came back.
var refit := 0.0
## Battle time of the last radio report of each kind, to avoid repeating it.
var reported: Dictionary[StringName, float] = {}

var role: BattleUnit.Role = BattleUnit.Role.NONE
## Cell a garrison holds; it lies in cover within the capture radius of the objective.
var home_cell := Vector2i(-1, -1)
var patrol: Array[Vector2i] = []
var patrol_index := 0
var wait_until := 0.0


func is_on_map() -> bool:
	return alive and carrier < 0


func max_strength() -> int:
	return UnitKind.STRENGTH[kind]


func mover() -> Terrain.Mover:
	return UnitKind.MOVER[kind]


func is_moving() -> bool:
	return path_index < path.size()
