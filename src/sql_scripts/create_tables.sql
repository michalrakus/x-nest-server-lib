CREATE TABLE x_user (
	id_x_user int NOT NULL auto_increment,
	username varchar(64) NOT NULL,
	password varchar(64) NOT NULL,
    name varchar(128) NOT NULL, -- meno a priezvisko
	PRIMARY KEY (id_x_user)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;

CREATE INDEX x_user_username_idx ON x_user (username);
