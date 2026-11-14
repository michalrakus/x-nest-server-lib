import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {XUser} from "./x-user.entity";

// one row per save (rowData = snapshot) or per remove (rowData = null, removed = true)
@Entity("x_audit_row")
export class XAuditRow {

    @PrimaryGeneratedColumn({type: "integer", name: "id"})
    id: number;

    @Column("character varying", {name: "entity", length: 128, nullable: false})
    entity: string;

    @Column("integer", {name: "row_id", nullable: false})
    rowId: number;

    @Column("timestamp without time zone", {name: "modif_date", nullable: false})
    modifDate: Date;

    @ManyToOne(() => XUser, {nullable: true})
    @JoinColumn([{name: "modif_x_user_id", referencedColumnName: "id"}])
    modifXUser: XUser | null;

    @Column("boolean", {name: "removed", nullable: false})
    removed: boolean;

    // select: false - the browse must not load the snapshot; it is read only in getAuditRowData
    @Column("jsonb", {name: "row_data", nullable: true, select: false})
    rowData: any | null;
}
