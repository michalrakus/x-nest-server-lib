import {Column, Entity, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import {XColumnMeta} from "./x-column-meta.entity";

@Entity('x_browse_meta')
export class XBrowseMeta {

    @PrimaryGeneratedColumn({name: 'id_x_browse_meta'})
    idXBrowseMeta: number;

    @Column({length: 64, nullable: false})
    entity: string;

    @Column({name: 'browse_id', length: 64, nullable: true})
    browseId: string;

    @Column({width: 6, nullable: true})
    rows: number;

    @OneToMany(type => XColumnMeta, columnMeta => columnMeta.browseMeta, {cascade: ["insert", "update", "remove"]})
    columnMetaList: XColumnMeta[];
}