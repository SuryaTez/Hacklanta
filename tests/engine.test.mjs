import assert from 'node:assert/strict';
import {seed,compile,match,fund,funded,outstanding,fundable,shortages,focusLabel,missionFocus,routeSummary,fundedNote,completeStop,impact,optimize,normalizeDonationCategory,validateDonation,validateDonationImage,donationResource,classifyNeed,coverage,rejections,eligibility,missionContext,hasVerifiedCoordinates,googleMapsUrl,googleDirectionsUrl} from '../dist/engine.js';
const d=seed();const m=d.missions[0];match(m,d.resources,d.volunteers[0]);
assert.equal(m.originalCost,612);assert.equal(m.communityValue,584);assert.equal(m.gap,28);
assert.equal(m.matches.filter(x=>x.category==='meal').reduce((s,x)=>s+x.fulfilledQuantity,0),80);
assert.equal(m.matches.filter(x=>x.category==='drink').reduce((s,x)=>s+x.fulfilledQuantity,0),100);
assert.equal(m.route.at(-1).provider,'Hope Community Shelter');assert.ok(m.route.at(-1).scheduledTime<=m.deadline);
assert.equal(fund(m,10,'Test sponsor'),10);assert.equal(outstanding(m),18);assert.equal(fund(m,1000,'Another sponsor'),18);assert.equal(outstanding(m),0);assert.equal(m.status,'Funded');
while(m.status!=='Completed')completeStop(m);assert.equal(m.route.filter(x=>x.completedAt).length,m.route.length);assert.equal(completeStop(m),false);
const x=impact(m);assert.equal(x.peopleServed,100);assert.equal(x.foodWeight,180);assert.equal(x.estimatedValueSaved,584);assert.equal(x.cashSpent,28);assert.equal(x.partners,4);
const noFridge=compile('Feed 50 people by 7 PM. We have $75 and no refrigeration.');match(noFridge,d.resources,d.volunteers[0]);assert.equal(noFridge.refrigeration,false);assert.ok(!noFridge.matches.some(x=>d.resources.find(r=>r.id===x.resourceId).storageType==='Refrigerated'));
const vegan=compile('Feed 20 people vegan dinner by 7 PM with refrigeration.');match(vegan,d.resources,d.volunteers[0]);assert.ok(vegan.matches.every(x=>d.resources.find(r=>r.id===x.resourceId).dietaryTags.includes('Vegan')));
const expired=d.resources.map(r=>({...r,availableUntil:970}));const empty=compile('Feed 100 people by 7 PM with refrigeration.');match(empty,expired,d.volunteers[0]);assert.equal(empty.matches.length,0);assert.ok(empty.gap>0);
const supplies=compile('Provide school supplies for 40 students by 7 PM. We have $50.');assert.equal(supplies.requirements[0].category,'supplies');assert.equal(supplies.people,40);assert.equal(supplies.budget,50);
const large=compile('Feed 200 people by 7 PM. We have $100 and refrigeration.');match(large,d.resources,d.volunteers[0]);assert.ok(large.gap>28);
const side=compile('Feed 10 people by 7 PM.');const sideResource={...d.resources[0],id:'side-test',category:'side',quantity:10,storageType:'Room temperature',availableUntil:1110};match(side,[sideResource],d.volunteers[0]);assert.ok(side.matches.some(x=>x.resourceId==='side-test'));
const reserved=compile('Feed 10 people by 7 PM.');const reservedResource={...d.resources[0],missionId:'another-mission',status:'Pickup Assigned'};match(reserved,[reservedResource],d.volunteers[0]);assert.ok(!reserved.matches.some(x=>x.resourceId===reservedResource.id));
const invalid=compile('Feed 10 people by 7 PM.');invalid.deadline=959;match(invalid,d.resources,d.volunteers[0]);assert.equal(invalid.matches.length,0);assert.equal(fund(invalid,-5,'Invalid'),0);
assert.equal(normalizeDonationCategory('food'),'meal');assert.equal(normalizeDonationCategory('water'),'drink');
assert.equal(validateDonationImage('image/jpeg',1024),'');assert.match(validateDonationImage('image/gif',1024),/JPG/);assert.match(validateDonationImage('image/png',6*1024*1024),/5 MB/);
const donation={businessName:'Sunrise Restaurant',donationTitle:'Lunch surplus',address:'675 Ponce de Leon Ave NE, Atlanta, GA',from:'16:00',until:'18:00',fromMinutes:960,untilMinutes:1080,storage:'Refrigerated',dietaryTags:['Vegetarian'],allergens:'Contains dairy',instructions:'Use loading door',items:[{name:'Pasta meals',description:'Sealed portions',quantity:12,unit:'meals',category:'food'}]};
assert.deepEqual(validateDonation(donation),[]);const donated=donationResource(donation,donation.items[0],'donation-test');assert.equal(donated.category,'meal');assert.equal(donated.status,'Available');assert.equal(donated.coordinatesResolved,true);const donationMission=compile('Feed 10 people by 7 PM with refrigeration.');match(donationMission,[donated,...d.resources],d.volunteers[0]);assert.ok(donationMission.matches.some(x=>x.resourceId==='donation-test'));
assert.ok(validateDonation({...donation,items:[{...donation.items[0],quantity:0}]}).some(x=>x.includes('quantity')));assert.ok(validateDonation({...donation,address:''}).some(x=>x.includes('Pickup address')));const unresolved=donationResource({...donation,address:'Unknown address, Atlanta, GA'},donation.items[0],'unresolved');assert.equal(unresolved.coordinatesResolved,false);const unresolvedMission=compile('Feed 10 people by 7 PM with refrigeration.');match(unresolvedMission,[unresolved],d.volunteers[0]);assert.equal(unresolvedMission.matches.length,0);
// Test A - non-food (school supplies) mission
const school=compile('Provide school supplies for 40 students by 7 PM. We have $50.');
match(school,d.resources,d.volunteers[0]);
assert.equal(school.requirements[0].category,'supplies');
assert.ok(!school.requirements.some(r=>r.category==='drink'));
assert.equal(school.people,40);
assert.equal(school.matches.filter(x=>x.category==='supplies').reduce((s,x)=>s+x.fulfilledQuantity,0),40);
assert.equal(missionFocus(school),'supplies');
assert.equal(focusLabel(school),'school supplies');
assert.equal(routeSummary(school),'Help deliver school supplies for 40 people.');
assert.ok(!/dinner|meal|lunch/i.test(routeSummary(school)));
assert.equal(school.route.find(s=>s.resourceId).name,'School supply kits');
assert.equal(school.route.at(-1).provider,'Hope Community Shelter');
assert.equal(school.gap,0);
assert.equal(outstanding(school),0);
assert.equal(shortages(school).length,0);
assert.equal(fundedNote(school),'');

// Test B - fully covered mission is not a fundable sponsor opportunity, but can dispatch
assert.equal(fundable(school),false);
assert.equal(fund(school,10,'Should be rejected'),0);
assert.equal(school.contributions.length,0);
assert.ok(school.matches.some(x=>x.category==='transportation'));
assert.equal(school.status,'Ready for review');
assert.ok(school.route.length>0&&school.route.at(-1).scheduledTime<=school.deadline);
assert.deepEqual([school].filter(fundable),[]);

// Test C - partially funded mission, overfunding prevented
const partial=compile('Provide school supplies for 60 students by 7 PM. We have $500.');
match(partial,d.resources,d.volunteers[0]);
const gapBefore=outstanding(partial);
assert.ok(gapBefore>0);
assert.equal(fundable(partial),true);
assert.equal(shortages(partial).length,1);
assert.equal(shortages(partial)[0].category,'supplies');
assert.equal(shortages(partial)[0].missing,20);
assert.equal(fund(partial,25,'Partial sponsor'),25);
assert.equal(outstanding(partial),Math.round((gapBefore-25)*100)/100);
assert.equal(partial.contributions.length,1);
assert.equal(partial.contributions[0].amount,25);
assert.equal(fund(partial,1000,'Overfund attempt'),Math.round((gapBefore-25)*100)/100);
assert.equal(outstanding(partial),0);
assert.equal(partial.status,'Funded');
assert.equal(partial.contributions.reduce((s,x)=>s+x.amount,0),gapBefore);
assert.ok(partial.contributions.every(x=>x.simulated===true));
assert.equal(fundable(partial),false);
assert.equal(shortages(partial)[0].missing,20);
assert.ok(fundedNote(partial).includes('simulated'));

// Test D - completion, impact recorded once, no zero-dollar funded-resource note
const done=seed().missions[0];
match(done,d.resources,d.volunteers[0]);
assert.equal(outstanding(done),28);
assert.equal(fundedNote(done),'');
fund(done,28,'Completion sponsor');
assert.ok(fundedNote(done).includes('$28'));
assert.ok(!/additional funded supplies/i.test(fundedNote(done)));
while(done.status!=='Completed')completeStop(done);
assert.equal(done.status,'Completed');
assert.equal(done.route.filter(x=>x.completedAt).length,done.route.length);
assert.equal(completeStop(done),false);
assert.equal(fundable(done),false);
assert.equal(fund(done,10,'Late sponsor'),0);
const doneImpact=impact(done);
assert.deepEqual(impact(done),doneImpact);
assert.equal(doneImpact.cashSpent,28);

// Test E - food mission regression
const reg=seed().missions[0];
match(reg,d.resources,d.volunteers[0]);
assert.equal(focusLabel(reg),'meals');
assert.equal(routeSummary(reg),'Help deliver meals for 100 people.');
assert.equal(shortages(reg).length,1);
assert.equal(shortages(reg)[0].category,'meal');
assert.equal(fundable(reg),true);
assert.deepEqual([reg,school].filter(fundable).map(x=>x.id),[reg.id]);
assert.equal(outstanding(reg),28);
// ===== Sprint 2: context-aware mission intelligence and explainable matching =====
// Test 1 - food mission: categories, quantities, dietary/storage constraints, generated explanations
const s2=seed();
const food2=compile('Feed 100 people tonight by 7 PM. We have $100 and refrigeration at our shelter.');
match(food2,s2.resources,s2.volunteers[0]);
assert.equal(missionContext(food2).food,true);
assert.equal(missionContext(food2).label,'meals');
const foodCoverage=coverage(food2);
assert.equal(foodCoverage.find(r=>r.category==='meal').status,'partial');
assert.equal(foodCoverage.find(r=>r.category==='meal').matched,80);
assert.equal(foodCoverage.find(r=>r.category==='meal').remaining,20);
assert.equal(foodCoverage.find(r=>r.category==='drink').status,'covered');
const mealMatch=food2.matches.find(x=>x.category==='meal');
assert.ok(mealMatch.reason.startsWith('Fulfills '));
assert.ok(mealMatch.reasons.includes('Pickup location verified'));
assert.ok(mealMatch.reasonCodes.includes('category_match'));
assert.equal(mealMatch.requirementLabel,'meals');
assert.ok(!/miles away/.test(mealMatch.reason));

// Test 2 - school supplies: right category, no bakery/meal terms, food context off
const school2=compile('Provide school supplies for 40 students by 7 PM. We have $50.');
match(school2,s2.resources,s2.volunteers[0]);
assert.equal(missionContext(school2).food,false);
assert.equal(missionContext(school2).label,'school-supply kits');
assert.equal(coverage(school2)[0].status,'covered');
assert.equal(coverage(school2)[0].matched,40);
assert.ok(!/meal|bakery|dinner|lunch/i.test(school2.matches.map(x=>x.reason).join(' ')));
assert.ok(school2.requirements.every(r=>!/diet|refrigerat/i.test(r.label||r.category)));

// Test 3 - partial availability: matched and remaining quantities stay separate
const partial2=compile('Provide school supplies for 60 students by 7 PM. We have $500.');
match(partial2,s2.resources,s2.volunteers[0]);
const partialCoverage=coverage(partial2).find(r=>r.category==='supplies');
assert.equal(partialCoverage.status,'partial');
assert.notEqual(partialCoverage.status,'covered');
assert.equal(partialCoverage.matched,40);
assert.equal(partialCoverage.remaining,20);
assert.equal(shortages(partial2)[0].missing,20);

// Test 4 - reservation conflicts are excluded with a grounded reason
const conflict=compile('Feed 10 people by 7 PM with refrigeration.');
const reservedForS2={...s2.resources.find(r=>r.id==='sunrise'),missionId:'another-mission',status:'Pickup Assigned'};
assert.equal(eligibility(reservedForS2,conflict.requirements[0],conflict).code,'reserved_elsewhere');
match(conflict,[reservedForS2],s2.volunteers[0]);
assert.equal(conflict.matches.filter(x=>x.resourceId===reservedForS2.id).length,0);
assert.ok(rejections(conflict,[reservedForS2]).some(x=>x.reasonCode==='reserved_elsewhere'));

// Test 5 - expired resources are excluded for the correct reason
const expiredResource={...s2.resources.find(r=>r.id==='sunrise'),availableUntil:970};
const expiredMission=compile('Feed 100 people by 7 PM with refrigeration.');
match(expiredMission,[expiredResource],s2.volunteers[0]);
assert.equal(expiredMission.matches.filter(x=>x.resourceId===expiredResource.id).length,0);
assert.ok(rejections(expiredMission,[expiredResource]).some(x=>x.reasonCode==='expired'&&/ended at/.test(x.explanation)));

// Test 6 - storage restrictions follow the mission's actual refrigeration capability
const noFridge2=compile('Feed 50 people by 7 PM. We have $75 and no refrigeration.');
match(noFridge2,s2.resources,s2.volunteers[0]);
assert.ok(!noFridge2.matches.some(x=>['sunrise','freshmart'].includes(x.resourceId)));
assert.ok(rejections(noFridge2,s2.resources).some(x=>x.reasonCode==='storage_mismatch'));
const fridge2=compile('Feed 50 people by 7 PM with refrigeration.');
match(fridge2,s2.resources,s2.volunteers[0]);
assert.ok(fridge2.matches.some(x=>x.resourceId==='sunrise'));
assert.ok(fridge2.matches.some(x=>x.reasonCodes.includes('refrigeration_compatible')));

// Test 7 - zero funding gap: no unnecessary sponsor contribution
assert.equal(outstanding(school2),0);
assert.equal(fundable(school2),false);
assert.equal(fund(school2,25,'Should not apply'),0);
assert.equal(school2.contributions.length,0);

// Test 8 - mixed requirements do not fulfill each other
const mixed=compile('Feed 100 people by 7 PM with refrigeration.');
match(mixed,s2.resources,s2.volunteers[0]);
const mixedCoverage=coverage(mixed);
assert.equal(mixedCoverage.find(r=>r.category==='meal').matched,80);
assert.equal(mixedCoverage.find(r=>r.category==='drink').matched,100);
assert.equal(mixed.matches.filter(x=>x.category==='meal').reduce((s,x)=>s+x.fulfilledQuantity,0),80);
assert.equal(mixed.matches.filter(x=>x.category==='drink').reduce((s,x)=>s+x.fulfilledQuantity,0),100);
assert.ok(!mixed.matches.some(x=>x.category==='meal'&&x.fulfilledQuantity>80));

// Test 9 - unsupported categories are labelled for human confirmation, never costed or invented
assert.equal(classifyNeed('Collect 20 blankets for families').kind,'clothing');
assert.equal(classifyNeed('Provide 30 hygiene kits').kind,'hygiene');
assert.equal(classifyNeed('Provide 20 laptops for students').kind,'school');
assert.equal(classifyNeed('Deliver 10 prescriptions').kind,'unsupported');
const meds=compile('Provide medication for 20 people by 7 PM. We have $300.');
assert.equal(meds.requirements[0].category,'unsupported');
assert.equal(meds.requirements[0].label,'medication');
assert.equal(missionContext(meds).unsupported,true);
match(meds,s2.resources,s2.volunteers[0]);
assert.equal(meds.matches.filter(x=>x.category==='unsupported').length,0);
const medsCoverage=coverage(meds).find(r=>r.category==='unsupported');
assert.equal(medsCoverage.status,'needs_confirmation');
assert.equal(medsCoverage.remaining,20);
assert.equal(shortages(meds).length,0);
assert.equal(meds.gap,0);
assert.equal(fundable(meds),false);

// Ambiguous descriptions are flagged instead of silently inventing quantities
assert.ok(compile('Help our community tonight.').clarification);
assert.ok(!compile('Feed 25 people by 7 PM.').clarification);

// Test 10 - existing workflows still function: donations, sponsor funding, routing, impact
const s2donation=donationResource({...donation,businessName:'Second Donor'},donation.items[0],'donation-s2');
assert.equal(s2donation.category,'meal');
const sponsorMission=seed().missions[0];
match(sponsorMission,s2.resources,s2.volunteers[0]);
assert.equal(fund(sponsorMission,28,'Sprint 2 sponsor'),28);
assert.equal(outstanding(sponsorMission),0);
while(sponsorMission.status!=='Completed')completeStop(sponsorMission);
assert.equal(sponsorMission.status,'Completed');
assert.deepEqual(impact(sponsorMission),impact(sponsorMission));
// Sprint 3 — location accuracy and no-key Google Maps links
const knownMission=compile('Feed 10 people by 7 PM.',{address:'675 Ponce de Leon Ave NE, Atlanta, GA'});
assert.equal(knownMission.coordinatesResolved,true);
assert.equal(knownMission.locationSource,'demo-address');
assert.ok(Math.abs(knownMission.lat-33.773)<1e-9&&Math.abs(knownMission.lng+84.38)<1e-9);
const unknownMission=compile('Feed 10 people by 7 PM.',{address:'1 Nowhere Lane, Atlanta, GA'});
assert.equal(unknownMission.coordinatesResolved,false);
assert.equal(unknownMission.locationSource,'unverified');
assert.equal(unknownMission.lat,undefined);
assert.equal(unknownMission.lng,undefined);
assert.equal(hasVerifiedCoordinates(unknownMission),false);
match(unknownMission,seed().resources,seed().volunteers[0]);
assert.equal(unknownMission.matches.length,0);
assert.equal(unknownMission.gap,0);
const unknownDonation=donationResource({...donation,address:'1 Nowhere Lane, Atlanta, GA'},donation.items[0],'no-coords');
assert.equal(unknownDonation.coordinatesResolved,false);
assert.equal(unknownDonation.lat,undefined);
assert.equal(googleMapsUrl(unknownDonation),`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('1 Nowhere Lane, Atlanta, GA')}`);
assert.equal(googleMapsUrl(knownMission),'https://www.google.com/maps/search/?api=1&query=33.773000,-84.380000');
assert.equal(googleDirectionsUrl(knownMission),'https://www.google.com/maps/dir/?api=1&destination=33.773000,-84.380000');
assert.ok(!googleDirectionsUrl(unknownMission).includes('33.751'));
console.log('Passed: exact demo economics and all prior Sprint 1 regressions. Passed Sprint 2: food and supply context, generated match explanations, correct partial/remaining quantities, reservation and expiry rejection reasons, storage rules, zero-gap protection, independent mixed requirements, unsupported-category confirmation, clarification prompts, and unchanged donation/sponsor/volunteer/impact workflows. Passed Sprint 3 mapping: verified coordinates only, no shelter-coordinate fallback for unknown addresses, and no-key Google Maps links.');
