CREATE TABLE x_user (
	id_x_user int NOT NULL auto_increment,
	username varchar(64) NOT NULL,
	password CHAR(60), -- not used if auth2 used
    name varchar(128) NOT NULL, -- family name + surname
    enabled tinyint(1) NOT NULL default 1,
	PRIMARY KEY (id_x_user)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4;

ALTER TABLE x_user ADD CONSTRAINT uq_x_user_username UNIQUE KEY(username);

CREATE TABLE x_browse_meta (
	id_x_browse_meta int NOT NULL auto_increment,
    entity varchar(64) NOT NULL,
    browse_id varchar(64),
    `rows` int(6),
	PRIMARY KEY (id_x_browse_meta)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4;

CREATE TABLE x_column_meta (
	id_x_column_meta int NOT NULL auto_increment,
    field varchar(64) NOT NULL,
    header varchar(64),
    align enum('left','center','right'),
    dropdown_in_filter tinyint(1) NOT NULL default 0,
    width varchar(16),
    column_order int(3) NOT NULL,
	id_x_browse_meta int NOT NULL,
	PRIMARY KEY (id_x_column_meta)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8mb4;

ALTER TABLE x_column_meta ADD CONSTRAINT x_column_meta_x_browse_meta FOREIGN KEY (id_x_browse_meta) REFERENCES x_browse_meta (id_x_browse_meta);
