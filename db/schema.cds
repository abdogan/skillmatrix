namespace skillmatrix;

entity TeamMembers {
  key KID             : String;
  FIRST_NAME          : String;
  LAST_NAME           : String;
  EMAIL               : String;
  CAPACITY            : Decimal(4,2);
  LOCATION            : UUID;
  TO_LOCATION         : Association to Locations on TO_LOCATION.LOCATION = LOCATION;
  TO_MEMBER_SKILLS    : Composition of many TeamMembersSkills on TO_MEMBER_SKILLS.KID = KID;
  TO_CAPACITY         : Composition of many TeamMemberCapacity on TO_CAPACITY.KID = KID;
}

entity TeamMembersSkills {
  key KID     : String;
  key SKILL   : UUID;
  SCORE       : Integer;
  TO_MEMBER   : Association to TeamMembers on TO_MEMBER.KID = KID;
  TO_SKILL    : Association to Skills on TO_SKILL.SKILL = SKILL;
}

entity Skills {
  key SKILL   : UUID;
  SHORT_DESC  : String;
  LONG_DESC   : String;
}

entity Locations {
  key LOCATION : UUID;
  CITY         : String;
  COUNTRY      : String;
}

entity TeamMemberCapacity {
  key KID     : String;
  key WEEK_ID : String;

  DATE_RANGE  : String;
  CAPACITY    : Decimal(4,2);
}