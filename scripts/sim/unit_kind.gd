class_name UnitKind
extends RefCounted
## Unit types and their numbers. Every table is indexed by Type.

## SCOUT is the sniper pair, MG the machine-gun team.
enum Type { RIFLE, SCOUT, APC, MG }

const MOVER: Array[Terrain.Mover] = [
	Terrain.Mover.INFANTRY, Terrain.Mover.INFANTRY, Terrain.Mover.VEHICLE, Terrain.Mover.INFANTRY,
]
## Units of distance per second on open ground.
const SPEED: Array[float] = [0.6, 0.75, 1.0, 0.5]
const WEAPON_RANGE: Array[float] = [6.0, 5.0, 7.0, 7.0]
const FIREPOWER: Array[float] = [1.0, 0.35, 1.3, 1.7]
const STRENGTH: Array[int] = [10, 4, 8, 6]
## Multiplier of the damage taken.
const ARMOUR: Array[float] = [1.0, 1.0, 0.6, 1.0]
## Multiplier of the position error in a contact reported by this unit.
const REPORT_ERROR: Array[float] = [1.0, 0.4, 1.0, 1.0]
## A moving unit stops when it sees an enemy closer than this.
const HALT_DISTANCE: Array[float] = [6.0, 8.0, 7.0, 7.0]
const COST: Array[int] = [100, 80, 160, 130]
## How many infantry units it carries.
const CAPACITY: Array[int] = [0, 0, 1, 0]

## How many rings of hexes around its own the unit can scout. A vehicle sees
## only the hex it stands in.
const SCOUT_RINGS: Array[int] = [2, 4, 0, 2]
## How many hexes it scouts at a time.
const SCOUT_BATCH: Array[int] = [1, 3, 1, 1]
## Multiplier of the time scouting takes.
const SCOUT_TIME: Array[float] = [1.0, 1.0, 1.0, 1.5]
