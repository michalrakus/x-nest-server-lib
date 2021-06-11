import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {XBrowseMeta} from "./x-browse-meta.entity";

@Entity('x_column_meta')
export class XColumnMeta {

    @PrimaryGeneratedColumn({name: 'id_x_column_meta'})
    idXColumnMeta: number;

    @Column({length: 64, nullable: false})
    field: string;

    @Column({length: 64, nullable: true})
    header: string;

    // enum 'left','center','right' (default null - means depends on type)
    @Column({length: 6, nullable: true})
    align: string;

    @Column({name: 'dropdown_in_filter', nullable: false})
    dropdownInFilter: boolean;

    @Column({length: 16, nullable: true})
    width: string;

    @Column({name: 'column_order', width: 3, nullable: false})
    columnOrder: number;

    @ManyToOne(type => XBrowseMeta, browseMeta => browseMeta.columnMetaList, {nullable: false})
    @JoinColumn({name: "id_x_browse_meta"})
    browseMeta: XBrowseMeta;
}
