import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {XBrowseMeta} from "./x-browse-meta.entity";

@Entity('x_column_meta')
export class XColumnMeta {

    @PrimaryGeneratedColumn({name: 'id_x_column_meta'})
    idXColumnMeta: number;

    @Column({length: 64, nullable: false})
    field: string;

    @Column({length: 64})
    header: string;

    // enum 'left','center','right' (default 'left')
    @Column({length: 6, nullable: false})
    align: string;

    @Column({name: 'dropdown_in_filter', nullable: false})
    dropdownInFilter: boolean;

    @Column({length: 16})
    width: string;

    @Column({name: 'column_order', width: 3})
    columnOrder: number;

    @ManyToOne(type => XBrowseMeta, browseMeta => browseMeta.columnMetaList)
    @JoinColumn({name: "id_x_browse_meta"})
    browseMeta: XBrowseMeta;
}
