import { EventEmitter } from 'events'
import { Readable } from 'stream'
import 'es2015.iterable'
import 'es2015.promise'

export enum Family {
  IPv4 = 'IPv4',
  IPv6 = 'IPv6'
}

export enum ChangeType {
  addInterface = 'add-interface',
  updateInterface = 'update-interface',
  deleteInterface = 'delete-interface',
  addAddress = 'add-address',
  updateAddress = 'update-address',
  deleteAddress = 'delete-address'
}

export enum NicType {
  wired = 'Wired',
  wireless = 'Wireless',
  firewire = 'Firewire',
  thunderbolt = 'Thunderbolt',
  bluetooth = 'Bluetooth',
  other = 'Other'
}

export type JSONStringMode = (json: any) => string

export const JSONStringModes: {
  lengthPrefixed: JSONStringMode
  concatenated: JSONStringMode
  recordSeparator: JSONStringMode
  line: JSONStringMode
}

export declare interface NetworkInterfaceInfo {
  id: string
  hash: string
  active: boolean
  nicType: NicType
}

export declare interface NetworkInterface {
  info: NetworkInterfaceInfo
  addresses: Set<Address>
}

export declare interface Address {
  address: string
  netmask: string
  family: Family
  mac: string
  scopeid?: number
  cidr: string
  internal: boolean
  key: string // key to be used in lookups for similar but not equal entries
  hash: string // hash to be identifying this exact entry
  interfaceId: string
}

export declare interface Change {
  interfaceId: string
  type: ChangeType
}

export declare interface AddDeleteAddress extends Change {
  type: ChangeType.addAddress | ChangeType.deleteAddress
  address: Address
}

export declare interface UpdateAddress extends Change {
  type: ChangeType.updateAddress
  address: Address
  oldAddress: Address
}

export declare interface AddDeleteInterface extends Change {
  type: ChangeType.addInterface | ChangeType.deleteInterface
  info: NetworkInterfaceInfo
}

export declare interface UpdateInterface extends Change {
  type: ChangeType.updateInterface
  info: NetworkInterfaceInfo
  oldInfo: NetworkInterfaceInfo
}

export declare type InterfaceChange = AddDeleteInterface | UpdateInterface
export declare type AddressChange = AddDeleteAddress | UpdateAddress
export declare type AnyChange = InterfaceChange | AddressChange

interface NetworkInterfacesOptions {
  maxAge: number
}

export declare class NetworkInterfaces extends EventEmitter {

  constructor (opts: NetworkInterfacesOptions)

  readonly maxAge

  update (): PromiseLike<void>
  checkUpdate (): PromiseLike<void>

  addEventListener(event: 'data', handler: (change: AnyChange) => void)
  on(event: 'data', handler: (change: AnyChange) => void)
  once(event: 'data', handler: (change: AnyChange) => void)
  prependListener(event: 'data', handler: (change: AnyChange) => void)
  prependOnceListener(event: 'data', handler: (change: AnyChange) => void)

  active (): NetworkInterface
  stream (stringMode?: JSONStringMode): {
    changes: Readable,
    warnings: Readable
  }

  matchSubnet (address: string): Address | null

  /**
   * Checks if a given address is part of the local addresses.
   */
  isLocalAddress (family: Family, address: string): boolean

  /**
   * To 
   * If the passed-in address is a local address it will return
   * the matching internal address, else it will just return
   * the address
   */
  preferInternalForLocal (family: Family, address: string): string
}

export declare const networkInterfaces: NetworkInterfaces
