import {Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {Buffer} from "buffer";

@Entity('x_file')
export class XFile {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({length: 256, nullable: false})
    name: string;

    @Column({nullable: false})
    size: number;

    @Column({name: 'path_name', length: 256, nullable: true})
    pathName: string;

    // select: false - nechceme selectovat stlpec lebo obsahuje vela dat
    @Column({type: "longblob", nullable: true, select: false, })
    data: Buffer;
}
