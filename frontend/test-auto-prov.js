const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) throw new Error("No org found");

    // create a fake pending link
    const link = await prisma.whatsAppLink.create({
      data: {
        orgId: org.id,
        role: 'CAPATAZ',
        activationToken: 'TOKEN_1234567890123456789012345678901234567890123456789012345678901234',
        isActive: false
      }
    });

    console.log("Created link", link.id);

    // Call the same logic as handleInvitationToken
    const pending = link;
    const phone = '5491111111111';
    const waDisplayName = 'Javi Test';
    const resolvedName = waDisplayName;

    await prisma.$transaction(async (tx) => {
      let profileId = pending.profileId;
      if (!profileId) {
        console.log("Auto-provisioning profile");
        const newProfile = await tx.$queryRaw`
          INSERT INTO profiles (id, organization_id, first_name, phone, team_role, role, is_active)
          VALUES (
            gen_random_uuid(),
            ${pending.orgId}::uuid,
            ${resolvedName},
            ${phone},
            ${pending.role},
            'MEMBER',
            true
          )
          RETURNING id
        `;
        profileId = newProfile[0].id;
        console.log("Created profile", profileId);
      }
      
      await tx.whatsAppLink.update({
        where: { id: pending.id },
        data: {
          phone: phone,
          profileId: profileId,
          isActive: true,
          activationToken: null,
          tokenExpiresAt: null,
        },
      });
      console.log("Updated link");
    });
    console.log("Transaction succeeded");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
