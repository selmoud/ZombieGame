class_name Terrain
extends RefCounted
## Terrain types and what each of them does to movement, observation and combat.

enum Type { FIELD, ROAD, FOREST, HILL, TOWN, WATER, BRIDGE }
enum Mover { INFANTRY, VEHICLE }

## Speed multiplier per terrain type; 0 means the terrain cannot be entered.
const SPEED: Dictionary[Mover, Array] = {
	Mover.INFANTRY: [1.0, 1.0, 0.5, 0.6, 0.9, 0.0, 1.0],
	Mover.VEHICLE: [1.0, 2.0, 0.0, 0.5, 0.0, 0.0, 2.0],
}
## Multiplier of the distance at which a unit standing here is spotted.
const CONCEALMENT: Array[float] = [1.0, 1.0, 0.45, 1.0, 0.6, 1.0, 1.0]
## Multiplier of the sight range of a unit standing here.
const SIGHT: Array[float] = [1.0, 1.0, 0.8, 1.5, 1.0, 1.0, 1.0]
## Multiplier of the damage taken by a unit standing here.
const COVER: Array[float] = [1.0, 1.0, 0.7, 0.9, 0.5, 1.0, 1.0]


static func speed(type: Type, mover: Mover) -> float:
	return SPEED[mover][type]


static func is_passable(type: Type, mover: Mover) -> bool:
	return speed(type, mover) > 0.0
