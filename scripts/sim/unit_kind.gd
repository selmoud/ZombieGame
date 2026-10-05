class_name UnitKind
extends RefCounted
## Unit types and their numbers. Every table is indexed by Type.

enum Type { RIFLE, SCOUT, APC }

const MOVER: Array[Terrain.Mover] = [
	Terrain.Mover.INFANTRY, Terrain.Mover.INFANTRY, Terrain.Mover.VEHICLE,
]
## Cells per second on open ground.
const SPEED: Array[float] = [0.6, 0.75, 1.0]
## Cells.
const SIGHT: Array[float] = [9.0, 14.0, 8.0]
const WEAPON_RANGE: Array[float] = [6.0, 5.0, 7.0]
const FIREPOWER: Array[float] = [1.0, 0.35, 1.3]
const STRENGTH: Array[int] = [10, 4, 8]
## Multiplier of the distance at which the unit is spotted.
const VISIBILITY: Array[float] = [1.0, 0.5, 1.4]
## Multiplier of the damage taken.
const ARMOUR: Array[float] = [1.0, 1.0, 0.6]
## Multiplier of the position error in a contact reported by this unit.
const REPORT_ERROR: Array[float] = [1.0, 0.4, 1.0]
## A moving unit stops when it sees an enemy closer than this.
const HALT_DISTANCE: Array[float] = [6.0, 8.0, 7.0]
const COST: Array[int] = [100, 80, 160]
## How many infantry units it carries.
const CAPACITY: Array[int] = [0, 0, 1]
