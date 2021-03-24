import {DynamicModule, Module} from '@nestjs/common';
import {XLibController} from './x-lib.controller';
import {XLibService} from './x-lib.service';
import {XLazyDataTableService} from './x-lazy-data-table.service';
import {XEntityMetadataService} from "./x-entity-metadata.service";
import {TypeOrmModule, TypeOrmModuleOptions} from "@nestjs/typeorm";
import {XBrowseFormMetadataService} from "./x-browse-form-metadata.service";

// ak sa sem do @Module zapise TypeOrmModule.forFeature([XUser, Car, Brand, Drive, Country]), resp. ak sa ako parameter forRoot posle uz vytvoreny typeOrmModule,
// aplikacia vrati chybu: Connection "default" was not found
@Module({})
export class XLibModule {
  static forRoot(typeOrmModuleOptions: TypeOrmModuleOptions): DynamicModule {

    return {
      imports: [TypeOrmModule.forRoot(typeOrmModuleOptions)],
      controllers: [XLibController],
      providers: [
          XLibService,
          XLazyDataTableService,
          {provide: XEntityMetadataService, useValue: new XEntityMetadataService(typeOrmModuleOptions.entities)},
          XBrowseFormMetadataService
      ],
      module: XLibModule
    };
  }
}
