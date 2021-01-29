import {DynamicModule, Module} from '@nestjs/common';
import {Pokus1Controller} from './pokus1.controller';
import {Pokus1Service} from './pokus1.service';
import {LazyDataTableService} from './lazy-data-table.service';
import {EntityMetadataService} from "./entity-metadata.service";
import {TypeOrmModule, TypeOrmModuleOptions} from "@nestjs/typeorm";

// ak sa sem do @Module zapise TypeOrmModule.forFeature([XUser, Car, Brand, Drive, Country]), resp. ak sa ako parameter forRoot posle uz vytvoreny typeOrmModule,
// aplikacia vrati chybu: Connection "default" was not found
@Module({})
export class Pokus1Module {
  static forRoot(typeOrmModuleOptions: TypeOrmModuleOptions): DynamicModule {

    return {
      imports: [TypeOrmModule.forRoot(typeOrmModuleOptions)],
      controllers: [Pokus1Controller],
      providers: [Pokus1Service, LazyDataTableService, EntityMetadataService],
      module: Pokus1Module
    };
  }
}
