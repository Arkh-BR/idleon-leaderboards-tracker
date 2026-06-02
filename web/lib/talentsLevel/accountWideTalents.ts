// Re-export from the canonical location (arkh/) so the talent system
// can auto-detect account-wide ids without crossing layer boundaries.
// /talents-level UI imports from here for the visual badge.
export {
  ACCOUNT_WIDE_TALENT_IDS,
  ACCOUNT_WIDE_SPECIAL_BRANCH_IDS,
  isAccountWideTalent,
} from "../arkh/stats/data/common/account-wide-talents";
