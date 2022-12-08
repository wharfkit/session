import {Asset, Name, PublicKey, Struct, UInt16, UInt32} from '@greymass/eosio'

@Struct.type('key_weight')
export class KeyWeight extends Struct {
    @Struct.field(PublicKey) key!: PublicKey
    @Struct.field(UInt16) weight!: UInt16
}

@Struct.type('permission_level')
export class PermissionLevel extends Struct {
    @Struct.field(Name) actor!: Name
    @Struct.field(Name) permission!: Name
}

@Struct.type('permission_level_weight')
export class PermissionLevelWeight extends Struct {
    @Struct.field(PermissionLevel) permission!: PermissionLevel
    @Struct.field(UInt16) weight!: UInt16
}

@Struct.type('wait_weight')
export class WaitWeight extends Struct {
    @Struct.field(UInt32) wait_sec!: UInt32
    @Struct.field(UInt16) weight!: UInt16
}

@Struct.type('authority')
export class Authority extends Struct {
    @Struct.field(UInt32) threshold!: UInt32
    @Struct.field(KeyWeight, {array: true}) keys!: KeyWeight[]
    @Struct.field(PermissionLevelWeight, {array: true}) accounts!: PermissionLevelWeight[]
    @Struct.field(WaitWeight, {array: true}) waits!: WaitWeight[]
}

@Struct.type('newaccount')
export class Newaccount extends Struct {
    @Struct.field(Name) creator!: Name
    @Struct.field(Name) name!: Name
    @Struct.field(Authority) owner!: Authority
    @Struct.field(Authority) active!: Authority
}

@Struct.type('buyrambytes')
export class Buyrambytes extends Struct {
    @Struct.field(Name) payer!: Name
    @Struct.field(Name) receiver!: Name
    @Struct.field(UInt32) bytes!: UInt32
}

@Struct.type('delegatebw')
export class Delegatebw extends Struct {
    @Struct.field(Name) from!: Name
    @Struct.field(Name) receiver!: Name
    @Struct.field(Asset) stake_net_quantity!: Asset
    @Struct.field(Asset) stake_cpu_quantity!: Asset
    @Struct.field('bool') transfer!: boolean
}

@Struct.type('transfer')
export class Transfer extends Struct {
    @Struct.field(Name) from!: Name
    @Struct.field(Name) to!: Name
    @Struct.field(Asset) quantity!: Asset
    @Struct.field('string') memo!: string
}

@Struct.type('updateauth')
export class Updateauth extends Struct {
    @Struct.field(Name) account!: Name
    @Struct.field(Name) permission!: Name
    @Struct.field(Name) parent!: Name
    @Struct.field(Authority) auth!: Authority
    @Struct.field(Name, {extension: true}) authorized_by!: Name
}

@Struct.type('linkauth')
export class Linkauth extends Struct {
    @Struct.field(Name) account!: Name
    @Struct.field(Name) code!: Name
    @Struct.field(Name) type!: Name
    @Struct.field(Name) requirement!: Name
    @Struct.field(Name, {extension: true}) authorized_by!: Name
}
