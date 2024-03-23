import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn, VersionColumn,
} from "typeorm";
import {XUser} from "./x-user.entity";

@Entity("x_param")
export class XParam {
    @PrimaryGeneratedColumn({ type: "integer", name: "id" })
    id: number;

    @Column("character varying", { name: "code", length: 64, nullable: false })
    code: string;

    @Column("character varying", { name: "name", length: 128, nullable: false })
    name: string;

    @Column("character varying", { name: "value", nullable: false })
    value: string;

    @Column("timestamp without time zone", { name: "modif_date", nullable: true })
    modifDate: Date | null;

    @ManyToOne(() => XUser, { nullable: true })
    @JoinColumn([{ name: "modif_x_user_id", referencedColumnName: "id" }])
    modifXUser: XUser | null;

    @VersionColumn()
    version: number;
}
