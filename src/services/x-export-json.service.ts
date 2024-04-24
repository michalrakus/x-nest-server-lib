import {HttpStatus, Injectable} from "@nestjs/common";
import {XExportService} from "./x-export.service";
import {SelectQueryBuilder} from "typeorm";
import {Response} from "express";
import {XUtilsCommon} from "../serverApi/XUtilsCommon";
import {ReadStream} from "fs";

@Injectable()
export class XExportJsonService extends XExportService {

    async exportJsonUsingList(selectQueryBuilder: SelectQueryBuilder<unknown>, res: Response): Promise<void> {

        const rowList: any[] = await selectQueryBuilder.getMany();

        res.write(XUtilsCommon.objectAsJSON(rowList), "utf8");

        res.status(HttpStatus.OK);
        res.end();
    }

    async exportJsonUsingStream(selectQueryBuilder: SelectQueryBuilder<unknown>, res: Response): Promise<void> {

        const readStream: ReadStream = await selectQueryBuilder.stream();

        res.write("[", "utf8");

        let firstRow = true;

        readStream.on('data', data => {
            const entityObj = this.transformToEntity(data, selectQueryBuilder);
            let rowStr: string = "";
            if (firstRow) {
                firstRow = false;
            }
            else {
                rowStr += ",";
            }
            rowStr += XUtilsCommon.newLine;
            rowStr += XUtilsCommon.objectAsJSON(entityObj);
            res.write(rowStr, "utf8");
        });

        readStream.on('end', () => {
            res.write(XUtilsCommon.newLine + "]", "utf8");
            res.status(HttpStatus.OK);
            res.end();
        });
    }
}