import {EntitySubscriberInterface, EventSubscriber, OptimisticLockVersionMismatchError, UpdateEvent} from "typeorm";

/*
optimistic locking - used solution from https://github.com/typeorm/typeorm/issues/3608
works for every entity with column (of type number) decorated with @VersionColumn()
 */
@EventSubscriber()
export class XOptimisticLockingSubscriber implements EntitySubscriberInterface {

    beforeUpdate(event: UpdateEvent<any>) {
        // To know if an entity has a version number, we check if versionColumn
        // is defined in the metadatas of that entity.
        // if event.databaseEntity is undefined, then simple update is executed (not save) and we omit this check
        // that's why only save method executes optimistic locking check
        // however, update method also increments version column (TypeORM does it)
        if (event.metadata.versionColumn && event.entity && event.databaseEntity) {
            // Getting the current version of the requested entity update
            const versionFromUpdate = Reflect.get(
                event.entity,
                event.metadata.versionColumn.propertyName
            );

            // Getting the entity's version from the database
            const versionFromDatabase = event.databaseEntity[event.metadata.versionColumn.propertyName];

            // they should match otherwise someone has changed it underneath us
            if (versionFromDatabase !== versionFromUpdate) {
                throw new OptimisticLockVersionMismatchError(
                    event.metadata.name,
                    versionFromDatabase,
                    versionFromUpdate
                );
            }
        }
    }
}