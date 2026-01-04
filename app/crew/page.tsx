import { getCrewMembers } from "@/app/actions/crew";
import CrewMembersPage from "../components/crew/CrewMembersPage";
import { createCrewMember, updateCrewMember, deleteCrewMember, updateCrewLeaveStatus } from "../actions/crew";
import { checkIsAdmin } from "@/lib/auth";

export default async function CrewPage() {
  const crewMembers = await getCrewMembers();
  const isAdmin = await checkIsAdmin();

  return (
    <CrewMembersPage
      initialCrewMembers={crewMembers}
      createCrewMember={createCrewMember}
      updateCrewMember={updateCrewMember}
      deleteCrewMember={deleteCrewMember}
      updateCrewLeaveStatus={updateCrewLeaveStatus}
      isAdmin={isAdmin}
    />
  );
}

