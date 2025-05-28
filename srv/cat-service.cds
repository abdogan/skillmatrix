using skillmatrix as sm from '../db/schema';

service CatalogService {
    entity TeamMembers as projection on sm.TeamMembers;
    entity Locations as projection on sm.Locations;
    entity Skills as projection on sm.Skills;
    entity TeamMembersSkills as projection on sm.TeamMembersSkills;
    @cds.persistence.skip: false
    @cds.autoexpose
    entity TeamMemberCapacity as projection on sm.TeamMemberCapacity;
}
