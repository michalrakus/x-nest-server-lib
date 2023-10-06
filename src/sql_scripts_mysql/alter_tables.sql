ALTER TABLE x_user RENAME COLUMN id_x_user TO id;
ALTER TABLE x_user ADD admin tinyint(1) NOT NULL default 0 AFTER enabled;

ALTER TABLE x_browse_meta RENAME COLUMN id_x_browse_meta TO id;
ALTER TABLE x_column_meta RENAME COLUMN id_x_column_meta TO id;
ALTER TABLE x_column_meta RENAME COLUMN id_x_browse_meta TO x_browse_meta_id;
