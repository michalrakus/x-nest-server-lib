import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {XEnumEnum} from "./x-enum-enum.entity";

@Entity('x_enum')
export class XEnum {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({length: 64, nullable: false})
    code: string;

    @Column({length: 128, nullable: false})
    name: string;

    @Column({nullable: false})
    enabled: boolean;

    @Column({name: 'read_only', nullable: false})
    readOnly: boolean;

    @Column({name: 'enum_order', nullable: true})
    enumOrder: number;

    @ManyToOne(() => XEnumEnum, (xEnumEnum) => xEnumEnum.xEnumList, {nullable: false})
    @JoinColumn({name: 'x_enum_enum_id'})
    xEnumEnum: XEnumEnum;
}
