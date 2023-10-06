-- DROP TABLE x_file;
-- DROP TABLE x_column_meta;
-- DROP TABLE x_browse_meta;
-- DROP TABLE x_user;

CREATE TABLE x_user (
	id int NOT NULL auto_increment,
	username varchar(64) NOT NULL,
	password CHAR(60), -- not used if auth2 used
    name varchar(128) NOT NULL, -- family name + surname
    enabled tinyint(1) NOT NULL default 1,
    admin tinyint(1) NOT NULL default 0,
    modif_date DATETIME,
    modif_x_user_id int,
    version INT NOT NULL,
	PRIMARY KEY (id)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4;

ALTER TABLE x_user ADD CONSTRAINT uq_x_user_username UNIQUE KEY(username);
ALTER TABLE x_user ADD CONSTRAINT x_user_x_user FOREIGN KEY (modif_x_user_id) REFERENCES x_user (id);

CREATE TABLE x_browse_meta (
	id int NOT NULL auto_increment,
    entity varchar(64) NOT NULL,
    browse_id varchar(64),
    `rows` int(6),
	PRIMARY KEY (id)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4;

CREATE TABLE x_column_meta (
	id int NOT NULL auto_increment,
    field varchar(64) NOT NULL,
    header varchar(64),
    align enum('left','center','right'),
    dropdown_in_filter tinyint(1) NOT NULL default 0,
    width varchar(16),
    column_order int(3) NOT NULL,
	x_browse_meta_id int NOT NULL,
	PRIMARY KEY (id)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4;

ALTER TABLE x_column_meta ADD CONSTRAINT x_column_meta_x_browse_meta FOREIGN KEY (x_browse_meta_id) REFERENCES x_browse_meta (id);

-- MEDIUMBLOB has limit 16.78 MB
-- LONGBLOB has limit 4 GB
-- size is informative field
-- file can be saved in file system (path + name is saved in field path_name, data is null) or can be saved direct in field data (path_name is null)
CREATE TABLE x_file (
    id int NOT NULL auto_increment,
    name varchar(256) NOT NULL,
    size INT NOT NULL,
    path_name varchar(256),
    data LONGBLOB,
    modif_date DATETIME,
    modif_x_user_id int,
    PRIMARY KEY (id)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4;

ALTER TABLE x_file ADD CONSTRAINT x_file_x_user FOREIGN KEY (modif_x_user_id) REFERENCES x_user (id);
