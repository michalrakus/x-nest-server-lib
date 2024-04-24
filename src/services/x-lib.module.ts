import {DynamicModule, Module} from '@nestjs/common';
import {XLibController} from './x-lib.controller';
import {XLibService} from './x-lib.service';
import {XLazyDataTableService} from './x-lazy-data-table.service';
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {XBrowseFormMetadataService} from "./x-browse-form-metadata.service";
import {XFileController} from "./x-file.controller";
import {XFileService} from "./x-file.service";
import {XExportService} from "./x-export.service";
import {XExportCsvService} from "./x-export-csv.service";
import {XExportJsonService} from "./x-export-json.service";
import {XExportExcelService} from "./x-export-excel.service";

@Module({})
export class XLibModule {

    // pouzivame metodku forRoot() + DynamicModule aby sme mohli v pripade potreby odovzdat parametre z AppModule
  static forRoot(): DynamicModule {

    return {
      imports: [],
      controllers: [XLibController, XFileController],
      providers: [
          XLibService,
          XLazyDataTableService,
          XExportCsvService,
          XExportExcelService,
          XExportJsonService,
          XEntityMetadataService,
          XBrowseFormMetadataService,
          XFileService
      ],
        // servisy ktore su dostupne v inych moduloch
        exports: [
            XLibService,
            XFileService,
            XLazyDataTableService,
            XExportCsvService,
            XExportExcelService,
            XExportJsonService,
        ],
      module: XLibModule
    };
  }
}
