import {Body, Controller, Post, StreamableFile, UploadedFile, UseInterceptors} from "@nestjs/common";
import {XFileService} from "./x-file.service";
import {createReadStream, existsSync, mkdirSync, renameSync} from "fs";
import {Readable} from "stream";
import {XUtils} from "./XUtils";
import {XFile} from "../administration/x-file.entity";
import {FileInterceptor} from "@nestjs/platform-express";
import {join} from "path";
import {XFileJsonField} from "../serverApi/XFileJsonField";

@Controller()
export class XFileController {
    constructor(
        private readonly xFileService: XFileService) {
    }

    // uploadovany subor sa uklada do file systemu do adresara 'app-files/uploaded/'
    @Post('x-upload-file-into-file-system')
    @UseInterceptors(FileInterceptor('fileField', {dest: 'app-files/uploaded/'}))
    async uploadFileIntoFileSystem(@Body() body: any, @UploadedFile() file: Express.Multer.File/*, @Res() res: Response*/): Promise<XFile> {

        // body.jsonField je string, treba ho explicitne konvertovat na objekt, ani ked specifikujem typ pre "body" tak nefunguje
        const jsonField: XFileJsonField = JSON.parse(body.jsonField);

        // insertneme zaznam XFile a vratime ho
        // file.originalname ma zlu diakritiku, preto vezmeme filename z json-u
        // pathName vytvarame z id-cka, preto ho doplnime neskor - TODO - ziskat nove id-cko a spustit len insert
        const filename: string = jsonField.filename;
        const xFile: XFile = await this.xFileService.saveXFile({
            id: undefined,
            name: filename,
            size: file.size,
            pathName: null,
            data: null,
            modifDate: jsonField.modifDate,
            modifXUser: jsonField.modifXUser
        });

        // subor ulozime do adresara app-files/x-files/<jsonField.filepath>
        let destPath: string = XUtils.getXFilesDir();
        // adresar x-files by uz mal existovat
        // if (!existsSync(destPath)){
        //     mkdirSync(destPath);
        // }

        // k nazvu suboru pridame id-cko, aby sme vedeli ulozit aj 2 subory s rovnakym nazvom
        const filenameWithId: string = 'id-' + xFile.id + '-' + filename;
        let pathName: string = filenameWithId;
        if (jsonField.subdir) {
            pathName = join(jsonField.subdir, pathName);
            destPath = join(destPath, jsonField.subdir);
            // TODO - upravit aby fungovalo aj pre pripad ak sa jsonField.filepath sklada z viac ako jedneho adresara (mkdirSync vie vytvorit len 1 adresar)
            if (!existsSync(destPath)){
                mkdirSync(destPath);
            }
        }

        destPath = join(destPath, filenameWithId);

        // teraz mame napr.:
        // destPath: app-files/x-files/<jsonField.filepath>/id-123-fileXYZ.pdf
        // pathName:                   <jsonField.filepath>/id-123-fileXYZ.pdf

        renameSync(file.path, destPath);

        // zapiseme destPath do DB
        xFile.pathName = pathName;
        await this.xFileService.saveXFile(xFile);

        return xFile;
    }

    // vo FileInterceptor nie je uvedeny adresar, uploadovany subor sa uklada do pamete (do file.buffer)
    @Post('x-upload-file-into-db')
    @UseInterceptors(FileInterceptor('fileField'))
    uploadFileIntoDb(@Body() body: any, @UploadedFile() file: Express.Multer.File/*, @Res() res: Response*/): Promise<XFile> {

        // body.jsonField je string, treba ho explicitne konvertovat na objekt, ani ked specifikujem typ pre "body" tak nefunguje
        const jsonField: XFileJsonField = JSON.parse(body.jsonField);

        // insertneme zaznam XFile a vratime ho
        // file.originalname ma zlu diakritiku, preto vezmeme filename z json fieldu
        return this.xFileService.saveXFile({
            id: undefined,
            name: jsonField.filename,
            size: file.buffer.byteLength,
            pathName: null,
            data: file.buffer,
            modifDate: jsonField.modifDate,
            modifXUser: jsonField.modifXUser
        });
    }

    @Post('x-download-file')
    async downloadFile(@Body() body: {xFileId: number;}/*, @Res({ passthrough: true }) response: Response*/): Promise<StreamableFile> {

        const xFile: XFile = await this.xFileService.readXFileByIdWithData(body.xFileId);

        let readable: Readable;
        if (xFile.pathName) {
            // subor citame z adresara app-files/x-files/<xFile.pathName>
            let destPath: string = join(XUtils.getXFilesDir(), xFile.pathName);
            readable = createReadStream(destPath);
        }
        else {
            readable = Readable.from(xFile.data);
        }

        // ciel tohto je pri ukladani v browseri zapisat subor pod spravnym nazvom
        // nefungovalo mi to, musel som nazov suboru zapisat na klientovi
        // response.set({
        //   'Content-Disposition': `inline; filename="${xFile.filename}"`,
        //   'Content-Type': 'image'
        // })

        return new StreamableFile(readable);
    }

    private static getXFilesDir(): string {
        return join('app-files', 'x-files');
    }
}