CREATE TABLE x_user (
	id_x_user int NOT NULL auto_increment,
	username varchar(64) NOT NULL,
	password varchar(64) NOT NULL,
    name varchar(128) NOT NULL, -- meno a priezvisko
	PRIMARY KEY (id_x_user)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;

CREATE INDEX x_user_username_idx ON x_user (username);

CREATE TABLE x_browse_meta (
	id_x_browse_meta int NOT NULL auto_increment,
    entity varchar(64) NOT NULL,
    browse_id varchar(64),
    rows int(6),
	PRIMARY KEY (id_x_browse_meta)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;

CREATE TABLE x_column_meta (
	id_x_column_meta int NOT NULL auto_increment,
    field varchar(64) NOT NULL,
    header varchar(64),
    align enum('left','center','right'),
    dropdown_in_filter tinyint(1) NOT NULL default 0,
    width varchar(16),
    column_order int(3),
	id_x_browse_meta int NOT NULL,
	PRIMARY KEY (id_x_column_meta)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;

ALTER TABLE x_column_meta ADD CONSTRAINT x_column_meta_x_browse_meta FOREIGN KEY (id_x_browse_meta) REFERENCES x_browse_meta (id_x_browse_meta);
